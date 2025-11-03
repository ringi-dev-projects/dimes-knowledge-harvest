import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { db } from '@/lib/db';
import { interviewAutosaves, interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { InterviewMessage } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let sessionId: number | null = null;
    let rawMessages: unknown = [];
    let audioFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const sessionValue = formData.get('sessionId');
      if (typeof sessionValue === 'string' && sessionValue.trim().length > 0) {
        sessionId = Number(sessionValue);
      }

      const messagesValue = formData.get('messages');
      if (typeof messagesValue === 'string') {
        try {
          rawMessages = JSON.parse(messagesValue);
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid messages payload' },
            { status: 400 }
          );
        }
      }

      const audioValue = formData.get('audio');
      if (audioValue instanceof File && audioValue.size > 0) {
        audioFile = audioValue;
      }
    } else {
      const body = await request.json();
      sessionId = body?.sessionId ?? null;
      rawMessages = body?.messages ?? [];
    }

    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const [sessionRecord] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRecord) {
      return NextResponse.json(
        { error: 'Interview session not found' },
        { status: 404 }
      );
    }

    const parsedMessages = parseMessages(rawMessages);
    const transcriptToStore = JSON.stringify(parsedMessages);

    const audioUrl = audioFile
      ? await persistAudioFile(audioFile, sessionRecord.id)
      : sessionRecord.audioUrl ?? null;

    await db
      .update(interviewSessions)
      .set({
        endedAt: new Date(),
        transcript: transcriptToStore,
        status: 'completed',
        audioUrl,
      })
      .where(eq(interviewSessions.id, sessionId));

    await db.delete(interviewAutosaves).where(eq(interviewAutosaves.sessionId, sessionId));

    await runPostInterviewPipeline({
      origin: request.nextUrl.origin,
      companyId: sessionRecord.companyId,
      sessionId: sessionRecord.id,
      cookieHeader: request.headers.get('cookie') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Interview saved successfully',
      sessionId,
      audioUrl,
    });
  } catch (error) {
    console.error('Error ending interview:', error);
    return NextResponse.json(
      {
        error: 'Failed to save interview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function parseMessages(payload: unknown): InterviewMessage[] {
  if (Array.isArray(payload)) {
    return payload as InterviewMessage[];
  }

  return [];
}

async function persistAudioFile(file: File, sessionId: number) {
  const azureUrl = await persistToAzureBlob(file, sessionId);
  if (azureUrl) {
    return azureUrl;
  }

  const storage = resolveAudioStorage();

  try {
    await fs.mkdir(storage.directory, { recursive: true });
  } catch (error) {
    console.warn('Skipping audio persistence (mkdir failed):', error);
    return null;
  }

  const extension = detectAudioExtension(file.type);
  const fileName = `session-${sessionId}-${Date.now()}.${extension}`;
  const filePath = path.join(storage.directory, fileName);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);
  } catch (error) {
    console.warn('Skipping audio persistence (write failed):', error);
    return null;
  }

  return storage.returnRelativePath ? `interviews/${fileName}` : null;
}

async function persistToAzureBlob(file: File, sessionId: number) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    return null;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });

    const extension = detectAudioExtension(file.type);
    const blobName = `interviews/session-${sessionId}-${Date.now()}.${extension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const arrayBuffer = await file.arrayBuffer();
    await blockBlobClient.uploadData(arrayBuffer, {
      blobHTTPHeaders: {
        blobContentType: file.type || 'application/octet-stream',
      },
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error('Azure Blob upload failed, falling back to local storage:', error);
    return null;
  }
}

function resolveAudioStorage(): { directory: string; returnRelativePath: boolean } {
  const configured = process.env.AUDIO_STORAGE_DIR;
  if (configured) {
    return { directory: configured, returnRelativePath: false };
  }

  if (process.env.VERCEL === '1') {
    return { directory: path.join('/tmp', 'interviews'), returnRelativePath: false };
  }

  return { directory: path.join(process.cwd(), 'data', 'interviews'), returnRelativePath: true };
}

function detectAudioExtension(mimeType: string) {
  switch (mimeType) {
    case 'audio/webm':
    case 'audio/webm;codecs=opus':
      return 'webm';
    case 'audio/ogg':
    case 'audio/ogg;codecs=opus':
      return 'ogg';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
    default:
      return 'bin';
  }
}

async function runPostInterviewPipeline(params: {
  origin: string;
  companyId: number;
  sessionId: number;
  cookieHeader?: string;
}) {
  const { origin, companyId, sessionId, cookieHeader } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  const protectionBypass = process.env.VERCEL_DEPLOYMENT_PROTECTION_BYPASS;
  if (protectionBypass) {
    headers['x-vercel-protection-bypass'] = protectionBypass;
  }

  try {
    await fetch(`${origin}/api/knowledge/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.error('Knowledge extraction pipeline failed:', error);
  }

  try {
    await fetch(`${origin}/api/coverage/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ companyId }),
    });
  } catch (error) {
    console.error('Coverage calculation pipeline failed:', error);
  }
}

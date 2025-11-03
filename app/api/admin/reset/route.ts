import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  knowledgeAtoms,
  qaTurns,
  coverageScores,
  exportJobs,
  interviewSessions,
  topicTrees,
  companies,
  interviewAutosaves,
} from '@/lib/db/schema';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(_request: NextRequest) {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(knowledgeAtoms);
      await tx.delete(qaTurns);
      await tx.delete(coverageScores);
      await tx.delete(exportJobs);
      await tx.delete(interviewAutosaves);
      await tx.delete(interviewSessions);
      await tx.delete(topicTrees);
      await tx.delete(companies);
    });

    const audioDir = path.join(process.cwd(), 'data', 'interviews');
    try {
      await fs.rm(audioDir, { recursive: true, force: true });
      await fs.mkdir(audioDir, { recursive: true });
    } catch (fsError) {
      if (fsError && typeof fsError === 'object' && 'code' in fsError && (fsError as NodeJS.ErrnoException).code === 'EROFS') {
        console.info('Reset audio directory skipped on read-only filesystem (expected on Vercel).');
      } else {
        console.warn('Reset audio directory skipped:', fsError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reset data:', error);
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    );
  }
}

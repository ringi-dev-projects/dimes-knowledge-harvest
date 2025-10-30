'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewMessage } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';

type SessionStatus = 'idle' | 'connecting' | 'active' | 'ended';

interface RealtimeSessionPayload {
  success: boolean;
  sessionId: number;
  clientSecret: string;
  webrtcUrl: string;
  model: string;
  voice: string;
  instructions: string;
  companyName?: string | null;
  topicTreeId?: number | null;
  expiresAt?: number | null;
}

const TRANSCRIPTION_MODEL = 'whisper-1';
const TRANSCRIPTION_LANGUAGE = 'en';
const DEFAULT_INSTRUCTIONS =
  'You are a helpful interviewer focused on capturing operational knowledge with open-ended, respectful questions.';

export default function InterviewPage() {
  const { companyId, companyName } = useCompany();

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [error, setError] = useState('');

  const sessionIdRef = useRef<number | null>(null);
  const messagesRef = useRef<InterviewMessage[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const assistantResponsesRef = useRef<Map<string, { index: number }>>(new Map());
  const userItemsRef = useRef<Map<string, { index: number }>>(new Map());
  const sessionConfigRef = useRef<{ voice: string; instructions: string }>({
    voice: 'verse',
    instructions: DEFAULT_INSTRUCTIONS,
  });
  const audioRef = useRef<HTMLAudioElement>(null);

  const updateMessages = useCallback(
    (updater: (prev: InterviewMessage[]) => InterviewMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  const appendMessage = useCallback(
    (message: InterviewMessage) => {
      let index = -1;
      updateMessages((prev) => {
        const next = [...prev, message];
        index = next.length - 1;
        return next;
      });
      return index;
    },
    [updateMessages]
  );

  const updateMessageAt = useCallback(
    (index: number, updater: (message: InterviewMessage) => InterviewMessage) => {
      updateMessages((prev) => {
        if (!prev[index]) {
          return prev;
        }
        const next = [...prev];
        next[index] = updater(next[index]);
        return next;
      });
    },
    [updateMessages]
  );

  const sendSessionBootstrap = useCallback(() => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      return;
    }

    const meta = sessionConfigRef.current;
    const payload = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: meta?.voice ?? 'verse',
        instructions: meta?.instructions ?? DEFAULT_INSTRUCTIONS,
        input_audio_transcription: {
          model: TRANSCRIPTION_MODEL,
          language: TRANSCRIPTION_LANGUAGE,
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
          interrupt_response: true,
        },
      },
    };

    channel.send(JSON.stringify(payload));
  }, []);

  const handleServerEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const eventType: string | undefined = payload?.type;
        if (!eventType) {
          return;
        }

        if (eventType === 'session.created') {
          setStatus('active');
          return;
        }

        if (eventType === 'session.error') {
          const message =
            payload?.error?.message || 'The realtime session reported an error. Please try again.';
          setError(message);
          return;
        }

        if (eventType === 'conversation.item.input_audio_transcription.completed') {
          const transcript: string = (payload?.transcript ?? '').trim();
          if (!transcript) {
            return;
          }
          const itemId: string | undefined = payload?.item_id;
          if (!itemId) {
            return;
          }
          let entry = userItemsRef.current.get(itemId);
          if (!entry) {
            const index = appendMessage({
              role: 'user',
              content: transcript,
              timestamp: Date.now(),
            });
            userItemsRef.current.set(itemId, { index });
          } else {
            updateMessageAt(entry.index, (message) => ({
              ...message,
              content: transcript,
              timestamp: Date.now(),
            }));
          }
          return;
        }

        if (eventType === 'conversation.item.input_audio_transcription.failed') {
          console.warn('Input transcription failed:', payload);
          return;
        }

        if (eventType === 'response.created') {
          const responseId: string | undefined = payload?.response?.id ?? payload?.response_id;
          if (!responseId) {
            return;
          }
          const index = appendMessage({
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          });
          assistantResponsesRef.current.set(responseId, { index });
          return;
        }

        if (
          eventType === 'response.output_text.delta' ||
          eventType === 'response.text.delta' ||
          eventType === 'response.audio_transcript.delta' ||
          eventType === 'response.output_audio_transcript.delta'
        ) {
          const responseId: string | undefined = payload?.response?.id ?? payload?.response_id;
          const delta: string =
            payload?.delta ??
            payload?.text ??
            payload?.output_text_delta ??
            payload?.output_audio_transcript_delta ??
            '';

          if (!responseId || !delta) {
            return;
          }

          const entry = assistantResponsesRef.current.get(responseId);
          if (!entry) {
            const index = appendMessage({
              role: 'assistant',
              content: delta,
              timestamp: Date.now(),
            });
            assistantResponsesRef.current.set(responseId, { index });
            return;
          }

          updateMessageAt(entry.index, (message) => ({
            ...message,
            content: (message.content || '') + delta,
            timestamp: Date.now(),
          }));
          return;
        }

        if (eventType === 'response.completed' || eventType === 'response.done') {
          const responseId: string | undefined = payload?.response?.id ?? payload?.response_id;
          if (!responseId) {
            return;
          }
          const entry = assistantResponsesRef.current.get(responseId);
          if (entry) {
            updateMessageAt(entry.index, (message) => ({
              ...message,
              timestamp: Date.now(),
            }));
          }
          return;
        }

        if (eventType === 'response.error') {
          console.error('Realtime response error:', payload);
          return;
        }
      } catch (err) {
        console.error('Failed to process realtime event:', err, event.data);
      }
    },
    [appendMessage, updateMessageAt]
  );

  const cleanupConnection = useCallback(() => {
    try {
      dataChannelRef.current?.close();
    } catch (error) {
      console.warn('Failed to close data channel:', error);
    }
    dataChannelRef.current = null;

    try {
      const pc = peerConnectionRef.current;
      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
    } catch (error) {
      console.warn('Failed to close peer connection:', error);
    }
    peerConnectionRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.warn('Failed to stop media recorder:', error);
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(
        recordedChunksRef.current.length > 0
          ? new Blob(recordedChunksRef.current, { type: 'audio/webm' })
          : null
      );
    }

    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob =
          recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: 'audio/webm' })
            : null;
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch (error) {
        console.warn('Failed to stop recorder cleanly:', error);
        resolve(null);
      }
    });
  }, []);

  const persistSession = useCallback(async (audioBlob: Blob | null) => {
    if (!sessionIdRef.current) {
      return;
    }

    const formData = new FormData();
    formData.append('sessionId', String(sessionIdRef.current));
    formData.append('messages', JSON.stringify(messagesRef.current));

    if (audioBlob) {
      formData.append('audio', audioBlob, `session-${sessionIdRef.current}.webm`);
    }

    const response = await fetch('/api/interview/end', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const payload = await safeParseJson(response);
      throw new Error(payload?.error || 'Failed to save interview session');
    }
  }, []);

  const startInterview = useCallback(async () => {
    if (isConnecting || isRecording) {
      return;
    }

    if (!companyId) {
      setError('Please generate a topic tree first from the Seed page');
      return;
    }

    setError('');
    setIsConnecting(true);
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      const response = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        const payload = await safeParseJson(response);
        throw new Error(payload?.error || 'Failed to create realtime session');
      }

      const data = (await response.json()) as RealtimeSessionPayload;
      if (!data?.clientSecret || !data.webrtcUrl) {
        throw new Error('Realtime session is missing connection credentials');
      }

      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      sessionConfigRef.current = {
        voice: data.voice ?? 'verse',
        instructions: data.instructions ?? DEFAULT_INSTRUCTIONS,
      };

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(() => undefined);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
          setStatus('active');
          setIsRecording(true);
          try {
            recorder.start();
          } catch (error) {
            console.warn('Unable to start media recorder:', error);
          }
        }
        if (peerConnection.connectionState === 'failed') {
          setError('The realtime connection dropped. Please try restarting the interview.');
        }
      };

      const dataChannel = peerConnection.createDataChannel('realtime');
      dataChannelRef.current = dataChannel;
      dataChannel.onopen = sendSessionBootstrap;
      dataChannel.onmessage = handleServerEvent;
      dataChannel.onerror = (event) => {
        console.error('Realtime data channel error:', event);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(`${data.webrtcUrl}?model=${encodeURIComponent(data.model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${data.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        throw new Error(
          text || 'Azure Realtime service rejected the WebRTC offer. Check model deployment.'
        );
      }

      const answer = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });

      setIsConnecting(false);
    } catch (err) {
      console.error('Interview start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setIsConnecting(false);
      setStatus('idle');
      cleanupConnection();
    }
  }, [cleanupConnection, companyId, handleServerEvent, isConnecting, isRecording, sendSessionBootstrap]);

  const stopInterview = useCallback(async () => {
    if (!sessionIdRef.current) {
      cleanupConnection();
      setIsRecording(false);
      setStatus('ended');
      return;
    }

    setIsRecording(false);
    setStatus('ended');

    try {
      const audioBlob = await finalizeRecording();
      await persistSession(audioBlob);
    } catch (err) {
      console.error('Failed to save interview session:', err);
      setError(err instanceof Error ? err.message : 'Failed to save interview session');
    } finally {
      cleanupConnection();
    }
  }, [cleanupConnection, finalizeRecording, persistSession]);

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, [cleanupConnection]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Connecting';
      case 'active':
        return 'Live';
      case 'ended':
        return 'Saved';
      default:
        return 'Idle';
    }
  }, [status]);

  return (
    <div className="page-shell space-y-10">
      <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <div className="flex flex-col gap-4">
          <span className="badge-soft">Interview studio</span>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Knowledge interview</h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            {companyName ? `${companyName} - ` : ''}Run a voice-first interview that adapts on the fly,
            captures transcripts, and feeds straight into coverage analytics.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={statusLabel} status={status} />
            {companyId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                <span aria-hidden="true">✓</span>
                Company ready (ID: {companyId})
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
                <span aria-hidden="true">!</span>
                Generate a topic tree to activate interviews
              </span>
            )}
            {sessionId && (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                Session #{sessionId}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isRecording ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  Recording
                </div>
              ) : isConnecting ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                  Connecting...
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Ready to start
                </div>
              )}
            </div>

            {isRecording ? (
              <button onClick={stopInterview} className="btn-danger">
                Stop interview
              </button>
            ) : (
              <button
                onClick={startInterview}
                className="btn-primary"
                disabled={isConnecting || !companyId}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
                Start interview
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Live transcript</h2>
            <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: '24rem' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-10 text-center text-slate-500">
                  <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                  <p className="text-sm">Click &quot;Start interview&quot; to begin capturing responses.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={`${msg.role}-${idx}-${msg.timestamp}`}
                    className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-lg rounded-2xl px-4 py-3 shadow-sm ${
                        msg.role === 'assistant'
                          ? 'bg-white text-slate-900'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        {msg.role === 'assistant' ? 'AI interviewer' : 'You'}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <audio ref={audioRef} style={{ display: 'none' }} />
        </section>

        <aside className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-900">Coverage progress</h2>
          <p className="mt-1 text-sm text-slate-500">Track how the conversation is filling your priority areas.</p>

          <div className="mt-6 space-y-5">
            <TopicProgress name="Products & Services" coverage={0} confidence={0} />
            <TopicProgress name="Processes" coverage={0} confidence={0} />
            <TopicProgress name="Equipment" coverage={0} confidence={0} />
            <TopicProgress name="Safety" coverage={0} confidence={0} />
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-700">Suggested follow-ups</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>- What are the main product lines?</li>
              <li>- Describe the assembly process.</li>
              <li>- What equipment is critical?</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TopicProgress({ name, coverage, confidence }: { name: string; coverage: number; confidence: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{name}</span>
        <span className="text-slate-400">{coverage}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${coverage}%` }}
        />
      </div>
      <div className="text-xs text-slate-400">
        Confidence: <span className="font-semibold text-slate-600">{confidence}%</span>
      </div>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: SessionStatus }) {
  const className = useMemo(() => {
    switch (status) {
      case 'active':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'connecting':
        return 'border-indigo-200 bg-indigo-50 text-indigo-600';
      case 'ended':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-500';
    }
  }, [status]);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${className}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-indigo-400 animate-pulse' : 'bg-slate-300'}`} />
      {label}
    </span>
  );
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

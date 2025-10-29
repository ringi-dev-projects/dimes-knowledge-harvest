'use client';

import { useState, useRef } from 'react';
import { useCompany } from '@/lib/context/CompanyContext';

export default function InterviewPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp: number }>>([]);
  const [error, setError] = useState('');
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { companyId, companyName } = useCompany();

  const startInterview = async () => {
    try {
      setError('');

      // Check if company is selected
      if (!companyId) {
        setError('Please generate a topic tree first from the Seed page');
        return;
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create session with backend
      const response = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);

      // Set up WebRTC connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Add audio track
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle incoming audio
      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play();
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Exchange SDP with backend (simplified - in production, use proper signaling)
      // For now, we'll use a mock conversation flow
      setIsRecording(true);
      addMessage('assistant', 'Hello! I am here to help capture your valuable knowledge. Let us start with your name and role at the company.');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      console.error('Interview start error:', err);
    }
  };

  const stopInterview = async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    setIsRecording(false);

    // Save interview session
    if (sessionId) {
      await fetch('/api/interview/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messages,
        }),
      });
    }
  };

  const addMessage = (role: string, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <div className="page-shell space-y-10">
      <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <div className="flex flex-col gap-4">
          <span className="badge-soft">Interview studio</span>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Knowledge interview</h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            {companyName ? `${companyName} - ` : ''}Run a voice-first interview that adapts on the fly, captures transcripts, and feeds straight into coverage analytics.
          </p>
          {companyId ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <span aria-hidden="true">✓</span>
              Ready with company ID: {companyId}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
              <span aria-hidden="true">!</span>
              Generate a topic tree to activate interviews
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        {/* Main Interview Panel */}
        <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isRecording ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  Recording
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Ready to start
                </div>
              )}
            </div>

            {!isRecording ? (
              <button onClick={startInterview} className="btn-primary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Start interview
              </button>
            ) : (
              <button onClick={stopInterview} className="btn-danger">
                Stop interview
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  <p className="text-sm">Click &quot;Start interview&quot; to begin capturing responses.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
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

        {/* Coverage Sidebar */}
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
              <li>• What are the main product lines?</li>
              <li>• Describe the assembly process.</li>
              <li>• What equipment is critical?</li>
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

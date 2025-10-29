'use client';

import { useState, useRef, useEffect } from 'react';

export default function InterviewPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp: number }>>([]);
  const [error, setError] = useState('');
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startInterview = async () => {
    try {
      setError('');

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create session with backend
      const response = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: 1, // TODO: Get from context or URL param
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Knowledge Interview</h1>
        <p className="mt-2 text-gray-600">
          Conduct a voice-first interview to capture expert knowledge
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Interview Panel */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium text-gray-700">Recording</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Ready to start</span>
                )}
              </div>

              {!isRecording ? (
                <button
                  onClick={startInterview}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  <svg className="inline-block h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Start Interview
                </button>
              ) : (
                <button
                  onClick={stopInterview}
                  className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  Stop Interview
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Transcript */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  <p className="mt-2">Click &quot;Start Interview&quot; to begin</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-lg rounded-lg px-4 py-2 ${
                        msg.role === 'assistant'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {msg.role === 'assistant' ? 'AI Interviewer' : 'You'}
                      </p>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <audio ref={audioRef} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Coverage Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Coverage Progress</h2>

            <div className="space-y-4">
              <TopicProgress name="Products & Services" coverage={0} confidence={0} />
              <TopicProgress name="Processes" coverage={0} confidence={0} />
              <TopicProgress name="Equipment" coverage={0} confidence={0} />
              <TopicProgress name="Safety" coverage={0} confidence={0} />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Next Questions</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• What are the main product lines?</li>
                <li>• Describe the assembly process</li>
                <li>• What equipment is critical?</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicProgress({ name, coverage, confidence }: { name: string; coverage: number; confidence: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{name}</span>
        <span className="text-gray-500">{coverage}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${coverage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1 text-gray-500">
        <span>Confidence: {confidence}%</span>
      </div>
    </div>
  );
}

'use client';

import Link from "next/link";
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

interface CoverageEntry {
  topicId: string;
  topicName: string;
  coverage: number;
  confidence: number;
}

interface TopicNode {
  id: string;
  name: string;
  weight: number;
  targets?: Array<{ id: string; q: string; required: boolean }>;
  children?: TopicNode[];
}

const TRANSCRIPTION_MODEL = 'whisper-1';
const TRANSCRIPTION_LANGUAGE = 'en';
const DEFAULT_INSTRUCTIONS =
  'You are a helpful interviewer focused on capturing operational knowledge with open-ended, respectful questions.';

const SPEAKER_THRESHOLD = 0.05;
const SPEAKER_DECAY_MS = 1200;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'update_coverage',
    description:
      'Call this to update live coverage progress for a topic. Provide the topic id, coverage percent, and confidence percent based on what the expert just said.',
    parameters: {
      type: 'object',
      properties: {
        topic_id: { type: 'string', description: 'The topic identifier from the topic tree.' },
        coverage_percent: {
          type: 'number',
          description: 'Progress for this topic from 0-100 based on answered questions.',
        },
        confidence_percent: {
          type: 'number',
          description: 'Confidence in the coverage from 0-100 based on clarity and corroboration.',
        },
        notes: {
          type: 'string',
          description: 'Optional context or highlights from the last answer.',
        },
      },
      required: ['topic_id', 'coverage_percent', 'confidence_percent'],
    },
  },
];

export default function InterviewPage() {
  const { companyId, companyName } = useCompany();

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [error, setError] = useState('');
  const [speakerLevels, setSpeakerLevels] = useState({ user: 0, assistant: 0 });
  const [coverageProgress, setCoverageProgress] = useState<CoverageEntry[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const sessionIdRef = useRef<number | null>(null);
  const messagesRef = useRef<InterviewMessage[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const assistantResponsesRef = useRef<Map<string, { index: number }>>(new Map());
  const userItemsRef = useRef<Map<string, { index: number }>>(new Map());
  const assistantItemsRef = useRef<Map<string, number>>(new Map());
  const userItemsByIdRef = useRef<Map<string, number>>(new Map());
  const sessionConfigRef = useRef<{ voice: string; instructions: string }>({
    voice: 'verse',
    instructions: DEFAULT_INSTRUCTIONS,
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeSpeakerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const assistantAnalyserRef = useRef<AnalyserNode | null>(null);
  const analyserSourcesRef = useRef<{ user?: MediaStreamAudioSourceNode; assistant?: MediaStreamAudioSourceNode }>({});
  const animationFrameRef = useRef<number | null>(null);
  const functionCallBuffersRef = useRef<Map<string, { name?: string; args: string }>>(new Map());
  const topicGraphRef = useRef<Map<string, TopicNode>>(new Map());
  const lastSpeakerRef = useRef<{ role: 'assistant' | 'user'; timestamp: number } | null>(null);

  const [activeSpeaker, setActiveSpeaker] = useState<'assistant' | 'user' | null>(null);
  const [postSessionInfo, setPostSessionInfo] = useState<{ sessionId: number; companyId?: number | null } | null>(null);

  const loadTopicContext = useCallback(async () => {
    if (!companyId) {
      setCoverageProgress([]);
      return;
    }

    try {
      setCoverageLoading(true);
      const [topicRes, coverageRes] = await Promise.all([
        fetch(`/api/topic-tree/latest?companyId=${companyId}`),
        fetch(`/api/coverage?companyId=${companyId}`),
      ]);

      let topicEntries: TopicNode[] = [];
      if (topicRes.ok) {
        const topicJson = await topicRes.json();
        const tree = topicJson?.topicTree;
        if (tree?.topics) {
          topicEntries = tree.topics as TopicNode[];
          topicGraphRef.current.clear();
          const flatten = (nodeList: TopicNode[]) => {
            nodeList.forEach((node) => {
              topicGraphRef.current.set(node.id, node);
              if (node.children) {
                flatten(node.children);
              }
            });
          };
          flatten(topicEntries);
        }
      }

      let initialCoverage: CoverageEntry[] = [];
      if (topicEntries.length > 0) {
        initialCoverage = topicEntries.slice(0, 4).map((topic) => ({
          topicId: topic.id,
          topicName: topic.name,
          coverage: 0,
          confidence: 0,
        }));
      }

      if (coverageRes.ok) {
        const coverageJson = await coverageRes.json();
        const metrics: CoverageEntry[] = (coverageJson?.metrics || []).map((metric: any) => ({
          topicId: metric.topicId,
          topicName: metric.topicName,
          coverage: metric.coveragePercent,
          confidence: metric.confidence,
        }));

        if (initialCoverage.length === 0) {
          initialCoverage = metrics.slice(0, 4);
        } else {
          initialCoverage = initialCoverage.map((entry) => {
            const match = metrics.find((metric) => metric.topicId === entry.topicId);
            return match
              ? { ...entry, coverage: match.coverage, confidence: match.confidence }
              : entry;
          });
        }
      }

      if (initialCoverage.length === 0) {
        initialCoverage = [
          { topicId: 'products_services', topicName: 'Products & Services', coverage: 0, confidence: 0 },
          { topicId: 'processes', topicName: 'Processes', coverage: 0, confidence: 0 },
          { topicId: 'equipment', topicName: 'Equipment', coverage: 0, confidence: 0 },
          { topicId: 'safety', topicName: 'Safety', coverage: 0, confidence: 0 },
        ];
      }

      setCoverageProgress(initialCoverage);
    } catch (error) {
      console.error('Failed to load topic context:', error);
      setCoverageProgress([
        { topicId: 'products_services', topicName: 'Products & Services', coverage: 0, confidence: 0 },
        { topicId: 'processes', topicName: 'Processes', coverage: 0, confidence: 0 },
        { topicId: 'equipment', topicName: 'Equipment', coverage: 0, confidence: 0 },
        { topicId: 'safety', topicName: 'Safety', coverage: 0, confidence: 0 },
      ]);
    } finally {
      setCoverageLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadTopicContext();
    } else {
      setCoverageProgress([]);
    }
  }, [companyId, loadTopicContext]);

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

  const markActiveSpeaker = useCallback((speaker: 'assistant' | 'user') => {
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
    }
    setActiveSpeaker(speaker);
    activeSpeakerTimeoutRef.current = setTimeout(() => {
      setActiveSpeaker(null);
    }, 1500);
    lastSpeakerRef.current = { role: speaker, timestamp: Date.now() };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        return null;
      }
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  }, []);

  const stopLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserSourcesRef.current.user?.disconnect();
    analyserSourcesRef.current.assistant?.disconnect();
    analyserSourcesRef.current = { };
    userAnalyserRef.current = null;
    assistantAnalyserRef.current = null;
    setSpeakerLevels({ user: 0, assistant: 0 });
  }, []);

  const computeLevel = (analyser: AnalyserNode | null) => {
    if (!analyser) {
      return 0;
    }
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    return Math.min(1, rms * 2);
  };

  const startLevelMonitoring = useCallback(() => {
    const loop = () => {
      const userLevel = computeLevel(userAnalyserRef.current);
      const assistantLevel = computeLevel(assistantAnalyserRef.current);
      setSpeakerLevels((prev) => {
        const smoothedUser = prev.user * 0.6 + userLevel * 0.4;
        const smoothedAssistant = prev.assistant * 0.6 + assistantLevel * 0.4;
        return { user: smoothedUser, assistant: smoothedAssistant };
      });

      const now = Date.now();
      if (userLevel > SPEAKER_THRESHOLD && userLevel > assistantLevel * 1.2) {
        markActiveSpeaker('user');
      } else if (assistantLevel > SPEAKER_THRESHOLD && assistantLevel > userLevel * 1.2) {
        markActiveSpeaker('assistant');
      } else if (lastSpeakerRef.current && now - lastSpeakerRef.current.timestamp > SPEAKER_DECAY_MS) {
        setActiveSpeaker(null);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }
  }, [markActiveSpeaker]);

  const setupAnalyserForStream = useCallback(
    (stream: MediaStream, role: 'assistant' | 'user') => {
      const audioCtx = ensureAudioContext();
      if (!audioCtx) {
        return;
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      if (role === 'user') {
        analyserSourcesRef.current.user?.disconnect();
        analyserSourcesRef.current.user = source;
        userAnalyserRef.current = analyser;
      } else {
        analyserSourcesRef.current.assistant?.disconnect();
        analyserSourcesRef.current.assistant = source;
        assistantAnalyserRef.current = analyser;
      }

      startLevelMonitoring();
    },
    [ensureAudioContext, startLevelMonitoring]
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
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
      },
    };

    channel.send(JSON.stringify(payload));
  }, []);

  const handleFunctionCall = useCallback(
    (callId: string, buffer: { name?: string; args: string }) => {
      const channel = dataChannelRef.current;
      const functionName = buffer.name;
      if (!functionName) {
        return;
      }

      let parsedArgs: any = null;
      if (buffer.args) {
        try {
          parsedArgs = JSON.parse(buffer.args);
        } catch (error) {
          console.warn('Failed to parse function call args:', buffer.args);
        }
      }

      if (functionName === 'update_coverage' && parsedArgs) {
        const topicId = parsedArgs.topic_id;
        if (topicId) {
          setCoverageProgress((prev) => {
            const existingIndex = prev.findIndex((entry) => entry.topicId === topicId);
            const coverageValue = typeof parsedArgs.coverage_percent === 'number' ? parsedArgs.coverage_percent : prev[existingIndex]?.coverage ?? 0;
            const confidenceValue = typeof parsedArgs.confidence_percent === 'number' ? parsedArgs.confidence_percent : prev[existingIndex]?.confidence ?? 0;
            const topicName = topicGraphRef.current.get(topicId)?.name || prev[existingIndex]?.topicName || topicId;
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = {
                ...next[existingIndex],
                topicName,
                coverage: Math.max(0, Math.min(100, coverageValue)),
                confidence: Math.max(0, Math.min(100, confidenceValue)),
              };
              return next;
            }
            return [
              ...prev,
              {
                topicId,
                topicName,
                coverage: Math.max(0, Math.min(100, coverageValue)),
                confidence: Math.max(0, Math.min(100, confidenceValue)),
              },
            ];
          });
        }
      }

      if (channel && channel.readyState === 'open') {
        const ackPayload = {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ status: 'ok' }),
          },
        };

        try {
          channel.send(JSON.stringify(ackPayload));
        } catch (error) {
          console.warn('Failed to acknowledge function call:', error);
        }
      }

      functionCallBuffersRef.current.delete(callId);
    },
    [setCoverageProgress]
  );

  const handleServerEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const eventType: string | undefined = payload?.type;
        if (!eventType) {
          return;
        }

        const ensureAssistantEntry = (responseId?: string, itemId?: string, initialContent = '') => {
          if (!responseId && !itemId) {
            return;
          }
          if (itemId && assistantItemsRef.current.has(itemId)) {
            return assistantItemsRef.current.get(itemId);
          }
          if (responseId) {
            const existing = assistantResponsesRef.current.get(responseId);
            if (existing) {
              if (itemId) {
                assistantItemsRef.current.set(itemId, existing.index);
              }
              return existing.index;
            }
          }
          const index = appendMessage({
            role: 'assistant',
            content: initialContent,
            timestamp: Date.now(),
          });
          if (responseId) {
            assistantResponsesRef.current.set(responseId, { index });
          }
          if (itemId) {
            assistantItemsRef.current.set(itemId, index);
          }
          return index;
        };

        const handleAssistantDelta = (delta: string, responseId?: string, itemId?: string) => {
          if (!delta) return;
          const index = ensureAssistantEntry(responseId, itemId);
          if (index === undefined) return;
          updateMessageAt(index, (message) => ({
            ...message,
            content: (message.content || '') + delta,
            timestamp: Date.now(),
          }));
        };

        const handleAssistantFinal = (text: string, responseId?: string, itemId?: string) => {
          const index = ensureAssistantEntry(responseId, itemId);
          if (index === undefined) return;
          updateMessageAt(index, (message) => ({
            ...message,
            content: text ?? message.content,
            timestamp: Date.now(),
          }));
        };

        switch (eventType) {
          case 'input_audio_buffer.speech_started':
            markActiveSpeaker('user');
            return;
          case 'response.output_audio_buffer.started':
          case 'response.audio.started':
            markActiveSpeaker('assistant');
            return;
          case 'session.created':
            setStatus('active');
            return;
          case 'session.error': {
            const message = payload?.error?.message || 'The realtime session reported an error. Please try again.';
            setError(message);
            return;
          }
          case 'conversation.item.input_audio_transcription.delta': {
            const transcript: string = (payload?.delta ?? '').trim();
            if (!transcript) return;
            const itemId: string | undefined = payload?.item_id;
            if (!itemId) return;
            markActiveSpeaker('user');
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
          case 'conversation.item.input_audio_transcription.completed': {
            const transcript: string = (payload?.transcript ?? '').trim();
            if (!transcript) return;
            const itemId: string | undefined = payload?.item_id;
            if (!itemId) return;
            markActiveSpeaker('user');
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
          case 'conversation.item.created': {
            const item = payload?.item;
            if (!item) return;
            if (item.type === 'message') {
              if (item.role === 'assistant') {
                const text = (item.content || [])
                  .filter((part: any) => part?.type === 'text' && part?.text)
                  .map((part: any) => part.text)
                  .join('');
                ensureAssistantEntry(undefined, item.id, text);
                if (text) markActiveSpeaker('assistant');
              } else if (item.role === 'user') {
                if (userItemsByIdRef.current.has(item.id)) {
                  return;
                }
                const text = (item.content || [])
                  .filter((part: any) => part?.type === 'text' && part?.text)
                  .map((part: any) => part.text)
                  .join('');
                if (text) {
                  markActiveSpeaker('user');
                  const index = appendMessage({
                    role: 'user',
                    content: text,
                    timestamp: Date.now(),
                  });
                  userItemsByIdRef.current.set(item.id, index);
                }
              }
            } else if (item.type === 'function_call') {
              const callId = item.call_id;
              if (!callId) return;
              const buffer = functionCallBuffersRef.current.get(callId) || { args: '' };
              buffer.name = item.name;
              functionCallBuffersRef.current.set(callId, buffer);
            }
            return;
          }
          case 'response.output_item.added': {
            const item = payload?.item;
            const responseId: string | undefined = payload?.response_id ?? payload?.response?.id;
            if (!item) return;
            if (item.type === 'message' && item.role === 'assistant') {
              const text = (item.content || [])
                .filter((part: any) => part?.type === 'text' && part?.text)
                .map((part: any) => part.text)
                .join('');
              ensureAssistantEntry(responseId, item.id, text);
              if (text) markActiveSpeaker('assistant');
            } else if (item.type === 'function_call') {
              const callId = item.call_id;
              if (!callId) return;
              const buffer = functionCallBuffersRef.current.get(callId) || { args: '' };
              buffer.name = item.name;
              functionCallBuffersRef.current.set(callId, buffer);
            }
            return;
          }
          case 'response.text.delta':
          case 'response.output_text.delta': {
            const delta = payload?.delta ?? '';
            if (!delta) return;
            markActiveSpeaker('assistant');
            handleAssistantDelta(delta, payload?.response_id, payload?.item_id);
            return;
          }
          case 'response.text.done':
          case 'response.output_text.done': {
            const text = payload?.text ?? '';
            handleAssistantFinal(text, payload?.response_id, payload?.item_id);
            return;
          }
          case 'response.content_part.added': {
            const part = payload?.part;
            if (part?.type === 'text' && part?.text) {
              markActiveSpeaker('assistant');
              handleAssistantDelta(part.text, payload?.response_id, payload?.item_id);
            }
            return;
          }
          case 'response.content_part.done': {
            const part = payload?.part;
            if (part?.type === 'text' && part?.text) {
              handleAssistantFinal(part.text, payload?.response_id, payload?.item_id);
            }
            return;
          }
          case 'response.audio_transcript.delta':
          case 'response.output_audio_transcript.delta': {
            const transcript: string = payload?.delta ?? '';
            if (!transcript) return;
            markActiveSpeaker('assistant');
            handleAssistantDelta(transcript, payload?.response_id, payload?.item_id);
            return;
          }
          case 'response.audio_transcript.done':
          case 'response.output_audio_transcript.done': {
            const transcript: string = payload?.transcript ?? '';
            handleAssistantFinal(transcript, payload?.response_id, payload?.item_id);
            return;
          }
          case 'response.function_call_arguments.delta': {
            const callId: string | undefined = payload?.call_id;
            if (!callId) return;
            const buffer = functionCallBuffersRef.current.get(callId) || { args: '' };
            buffer.args += payload?.delta ?? '';
            functionCallBuffersRef.current.set(callId, buffer);
            return;
          }
          case 'response.function_call_arguments.done': {
            const callId: string | undefined = payload?.call_id;
            if (!callId) return;
            const buffer = functionCallBuffersRef.current.get(callId) || { args: '' };
            if (payload?.arguments) {
              buffer.args = payload.arguments;
            }
            functionCallBuffersRef.current.set(callId, buffer);
            handleFunctionCall(callId, buffer);
            return;
          }
          case 'response.done': {
            const responseId: string | undefined = payload?.response?.id ?? payload?.response_id;
            if (!responseId) return;
            const entry = assistantResponsesRef.current.get(responseId);
            if (entry) {
              updateMessageAt(entry.index, (message) => ({
                ...message,
                timestamp: Date.now(),
              }));
            }
            return;
          }
          default:
            return;
        }
      } catch (err) {
        console.error('Failed to process realtime event:', err, event.data);
      }
    },
    [appendMessage, handleFunctionCall, markActiveSpeaker, updateMessageAt]
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
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
      activeSpeakerTimeoutRef.current = null;
    }
    setActiveSpeaker(null);
    setStopPending(false);
    stopLevelMonitoring();
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.warn('Failed to close audio context:', error);
      }
      audioContextRef.current = null;
    }
  }, [stopLevelMonitoring]);

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

    return true;
  }, []);

  const resetInterviewState = useCallback(() => {
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
      activeSpeakerTimeoutRef.current = null;
    }
    setMessages([]);
    messagesRef.current = [];
    assistantResponsesRef.current.clear();
    userItemsRef.current.clear();
    assistantItemsRef.current.clear();
    userItemsByIdRef.current.clear();
    functionCallBuffersRef.current.clear();
    setSessionId(null);
    sessionIdRef.current = null;
    setStatus('idle');
    setError('');
    setPostSessionInfo(null);
    setActiveSpeaker(null);
    setSpeakerLevels({ user: 0, assistant: 0 });
    stopLevelMonitoring();
    setStopPending(false);
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.warn('Failed to close audio context:', error);
      }
      audioContextRef.current = null;
    }
  }, [stopLevelMonitoring]);

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
    setPostSessionInfo(null);
    setSessionId(null);
    setStopPending(false);
    setMessages([]);
    messagesRef.current = [];
    assistantResponsesRef.current.clear();
    userItemsRef.current.clear();
    assistantItemsRef.current.clear();
    userItemsByIdRef.current.clear();
    functionCallBuffersRef.current.clear();

    try {
      if (companyId) {
        loadTopicContext();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setupAnalyserForStream(stream, 'user');

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
          setupAnalyserForStream(event.streams[0], 'assistant');
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
  }, [cleanupConnection, companyId, handleServerEvent, isConnecting, isRecording, loadTopicContext, sendSessionBootstrap, setupAnalyserForStream]);

  const stopInterview = useCallback(async () => {
    if (!sessionIdRef.current) {
      cleanupConnection();
      setIsRecording(false);
      setStatus('ended');
      return;
    }

    setStopPending(true);
    setIsRecording(false);
    setStatus('ended');

    try {
      const audioBlob = await finalizeRecording();
      await persistSession(audioBlob);
      if (sessionIdRef.current) {
        setPostSessionInfo({
          sessionId: sessionIdRef.current,
          companyId,
        });
      }
    } catch (err) {
      console.error('Failed to save interview session:', err);
      setError(err instanceof Error ? err.message : 'Failed to save interview session');
    } finally {
      cleanupConnection();
      sessionIdRef.current = null;
      setSessionId(null);
      setStopPending(false);
    }
  }, [cleanupConnection, companyId, finalizeRecording, persistSession]);

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, [cleanupConnection]);

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
    };
  }, []);

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

  const prioritizedTopics = useMemo(() => {
    if (!coverageProgress || coverageProgress.length === 0) {
      return [] as CoverageEntry[];
    }
    return [...coverageProgress]
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 3);
  }, [coverageProgress]);

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
              <button
                onClick={stopInterview}
                className="btn-danger"
                disabled={stopPending}
              >
                {stopPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Stopping…
                  </span>
                ) : (
                  'Stop interview'
                )}
              </button>
            ) : (
              <button
                onClick={startInterview}
                className="btn-primary"
                disabled={isConnecting || !companyId}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Starting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                      />
                    </svg>
                    Start interview
                  </span>
                )}
              </button>
            )}
          </div>

          <SpeakerIndicator activeSpeaker={activeSpeaker} levels={speakerLevels} />

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Live transcript</h2>
            <div
              ref={transcriptContainerRef}
              className="space-y-4 overflow-y-auto pr-1"
              style={{ maxHeight: '24rem' }}
            >
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

          {postSessionInfo && (
            <div className="mt-6 rounded-2xl border border-white/60 bg-white/95 p-6 shadow-lg ring-1 ring-slate-900/10 backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-900">Interview saved</h3>
              <p className="mt-2 text-sm text-slate-600">
                We captured the transcript, audio, and updated coverage metrics. What would you like to do next?
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/dashboard" className="btn-secondary">
                  View Dashboard
                </Link>
                {postSessionInfo.companyId ? (
                  <Link href={`/docs/${postSessionInfo.companyId}`} className="btn-secondary">
                    View Documentation
                  </Link>
                ) : null}
                <button onClick={resetInterviewState} className="btn-primary">
                  Start Another Interview
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Tip: You can revisit any session later from the dashboard&rsquo;s interview history.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-900">Coverage progress</h2>
          <p className="mt-1 text-sm text-slate-500">Track how the conversation is filling your priority areas.</p>

          <div className="mt-6 space-y-5">
            {coverageLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
                <div className="h-2 w-2 animate-ping rounded-full bg-indigo-400" />
                <span>Syncing coverage from recent sessions…</span>
              </div>
            ) : coverageProgress.length === 0 ? (
              <p className="text-sm text-slate-500">Coverage will populate as soon as the first topic is captured.</p>
            ) : (
              coverageProgress.slice(0, 6).map((entry) => (
                <TopicProgress
                  key={entry.topicId}
                  name={entry.topicName}
                  coverage={Math.round(entry.coverage)}
                  confidence={Math.round(entry.confidence)}
                />
              ))
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-700">Suggested follow-ups</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {prioritizedTopics.length === 0 ? (
                <li>Focus on capturing foundational knowledge for your highest priority topics.</li>
              ) : (
                prioritizedTopics.map((topic) => (
                  <li key={topic.topicId}>
                    • Explore more about <span className="font-medium text-slate-700">{topic.topicName}</span>&nbsp;
                    (currently {Math.round(topic.coverage)}% coverage, {Math.round(topic.confidence)}% confidence)
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      ></path>
    </svg>
  );
}

function TopicProgress({ name, coverage, confidence }: { name: string; coverage: number; confidence: number }) {
  const safeCoverage = Math.max(0, Math.min(100, coverage));
  const safeConfidence = Math.max(0, Math.min(100, confidence));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{name}</span>
        <span className="text-slate-400">{Math.round(safeCoverage)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${safeCoverage}%` }}
        />
      </div>
      <div className="text-xs text-slate-400">
        Confidence: <span className="font-semibold text-slate-600">{Math.round(safeConfidence)}%</span>
      </div>
    </div>
  );
}

function SpeakerIndicator({ activeSpeaker, levels }: { activeSpeaker: 'assistant' | 'user' | null; levels: { user: number; assistant: number } }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
      <span className="font-semibold text-slate-500">Live activity</span>
      <SpeakerPill label="You" isActive={activeSpeaker === 'user'} accent="user" level={levels.user} />
      <SpeakerPill label="AI interviewer" isActive={activeSpeaker === 'assistant'} accent="assistant" level={levels.assistant} />
    </div>
  );
}

function SpeakerPill({ label, isActive, accent, level }: { label: string; isActive: boolean; accent: 'assistant' | 'user'; level: number }) {
  const activeClasses =
    accent === 'assistant'
      ? 'bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30'
      : 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30';
  const inactiveClasses = 'bg-slate-100 text-slate-500';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium transition ${
        isActive ? `${activeClasses} animate-pulse` : inactiveClasses
      }`}
    >
      <span className={`flex items-center gap-1`}>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isActive
              ? accent === 'assistant'
                ? 'bg-white'
                : 'bg-white'
              : 'bg-slate-300'
          }`}
        />
        {label}
      </span>
      <LevelBars isActive={isActive} accent={accent} level={level} />
      {isActive ? <span className="text-xs uppercase tracking-wide">Speaking</span> : null}
    </span>
  );
}

function LevelBars({ isActive, accent, level }: { isActive: boolean; accent: 'assistant' | 'user'; level: number }) {
  const clamped = Math.max(0, Math.min(1, level));
  const barColorActive = accent === 'assistant' ? 'bg-white' : 'bg-white';
  const barColorInactive = 'bg-slate-400';
  const baseOpacity = isActive ? 1 : 0.5;
  const bars = [0.35, 0.65, 0.85, 1];

  return (
    <span className="ml-2 flex items-end gap-1">
      {bars.map((scale, idx) => {
        const height = Math.max(4, clamped * 24 * scale);
        return (
          <span
            key={idx}
            className={`w-1 rounded-full ${isActive ? barColorActive : barColorInactive}`}
            style={{
              height,
              opacity: baseOpacity - idx * 0.1,
              transition: 'height 120ms ease, opacity 120ms ease',
            }}
          />
        );
      })}
    </span>
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

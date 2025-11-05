'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewMessage } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';
import { useLocale } from '@/lib/context/LocaleContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { CoverageEvidenceSummary } from '@/lib/types';
import type { SpeechRecognitionResult } from 'microsoft-cognitiveservices-speech-sdk';
import { useAzureSpeechRecognizer } from './useAzureSpeechRecognizer';

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
  nextQuestions: string[];
  evidence: CoverageEvidenceSummary[];
}

interface TopicNode {
  id: string;
  name: string;
  weight: number;
  targets?: Array<{ id: string; q: string; required: boolean }>;
  children?: TopicNode[];
}

type TimerOptionId = '15' | '30' | 'unlimited';

interface TimerOption {
  id: TimerOptionId;
  minutes: number | null;
}

interface AutosaveSnapshot {
  sessionId: number;
  timerOption: TimerOptionId;
  secondsRemaining: number | null;
  secondsElapsed: number;
  extensionCount: number;
  coverage: CoverageEntry[];
  messages: InterviewMessage[];
  drafts?: InterviewMessage[];
  reviews?: ReviewEntry[];
  queue?: QuestionQueueSnapshot;
  feedback?: QuestionFeedbackMap;
  updatedAt: string;
}

interface QuestionQueueItem {
  topicId: string;
  topicName: string;
  targetId: string;
  question: string;
  required: boolean;
  weight: number;
  status: 'pending' | 'answered' | 'skipped';
}

interface QuestionQueueSnapshot {
  current: QuestionQueueItem | null;
  pending: QuestionQueueItem[];
  completed: QuestionQueueItem[];
}

type QuestionFeedbackMap = Record<string, 'up' | 'down'>;

interface ReviewEntry {
  id: string;
  messageId: string;
  reasons: string[];
  resolved: boolean;
  createdAt: number;
}

const TRANSCRIPTION_MODEL = 'whisper-1';

const SPEAKER_THRESHOLD = 0.05;
const SPEAKER_DECAY_MS = 1200;
const MERGE_THRESHOLD_MS = 2500;
const MERGE_CHAR_LIMIT = 320;
const REVIEW_LENGTH_THRESHOLD = 160;
const PUNCTUATION_REGEX = /[.!?。？！]/;
const REPEAT_CHAR_REGEX = /(.)\1{4,}/;
const EXCESSIVE_PUNCT_REGEX = /[!?]{3,}/;

const AUTOSAVE_INTERVAL_MS = 60_000;
const AUTOSAVE_MIN_GAP_MS = 15_000;

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

const TIMER_OPTIONS: TimerOption[] = [
  { id: '15', minutes: 15 },
  { id: '30', minutes: 30 },
  { id: 'unlimited', minutes: null },
];

const UNLIMITED_REMINDER_OPTIONS = [0, 10, 15, 20, 30];
const TRANSCRIPTION_ENGINE = process.env.NEXT_PUBLIC_TRANSCRIPTION_ENGINE ?? 'whisper';

export default function InterviewPage() {
  const { companyId, companyName } = useCompany();
  const { dictionary, locale } = useLocale();
  const tInterview = dictionary.interview;
  const isAzureTranscription = TRANSCRIPTION_ENGINE === 'azure';

  const transcriptionLanguage = locale === 'ja' ? 'ja' : 'en';
  const instructionsFallback = tInterview.ai.instructions;
  const defaultCoverageTopics = tInterview.defaults.topics;

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
  const [draftMessages, setDraftMessages] = useState<InterviewMessage[]>([]);
  const [transcriptView, setTranscriptView] = useState<'final' | 'draft'>('draft');
  const [speakerName, setSpeakerName] = useState('');
  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[]>([]);
  const [timerOption, setTimerOption] = useState<TimerOptionId>('15');
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState<number | null>(15 * 60);
  const [timerSecondsElapsed, setTimerSecondsElapsed] = useState(0);
  const [timerExtensionCount, setTimerExtensionCount] = useState(0);
  const [wrapUpModalOpen, setWrapUpModalOpen] = useState(false);
  const [wrapUpAutoDeadline, setWrapUpAutoDeadline] = useState<number | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<AutosaveSnapshot | null>(null);
  const [pendingResume, setPendingResume] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [unlimitedReminderMinutes, setUnlimitedReminderMinutes] = useState(20);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<QuestionQueueSnapshot>({
    current: null,
    pending: [],
    completed: [],
  });
  const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedbackMap>({});

  const sessionIdRef = useRef<number | null>(null);
  const messagesRef = useRef<InterviewMessage[]>([]);
  const draftMessagesRef = useRef<InterviewMessage[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const assistantResponseDraftRef = useRef<Map<string, string>>(new Map());
  const assistantItemDraftRef = useRef<Map<string, string>>(new Map());
  const userItemDraftRef = useRef<Map<string, string>>(new Map());
  const messageIndexRef = useRef<Map<string, number>>(new Map());
  const azureDraftIdRef = useRef<string | null>(null);
  const draftIndexRef = useRef<Map<string, number>>(new Map());
  const sessionConfigRef = useRef<{ voice: string; instructions: string }>({
    voice: 'verse',
    instructions: instructionsFallback,
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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wrapUpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveInFlightRef = useRef(false);
  const lastAutosaveAtRef = useRef<number>(0);
  const wrapUpTriggeredRef = useRef(false);
  const lastReminderAtRef = useRef<number | null>(null);
  const activeSessionStartedAtRef = useRef<number | null>(null);
  const reminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTimerConfigRef = useRef<{ remaining: number | null; elapsed: number; extensionCount: number } | null>(null);
  const queueStateRef = useRef<QuestionQueueSnapshot>(queueState);
  const questionFeedbackRef = useRef<QuestionFeedbackMap>(questionFeedback);
  const topicTreeRef = useRef<TopicNode[]>([]);
  const reviewEntriesRef = useRef<ReviewEntry[]>([]);

  const [activeSpeaker, setActiveSpeaker] = useState<'assistant' | 'user' | null>(null);
  const [postSessionInfo, setPostSessionInfo] = useState<{ sessionId: number; companyId?: number | null } | null>(null);
  const selectedTimer = useMemo(() => {
    const match = TIMER_OPTIONS.find((option) => option.id === timerOption);
    return match ?? TIMER_OPTIONS[0];
  }, [timerOption]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedOption = window.localStorage.getItem('interviewTimerOption');
    if (storedOption === '15' || storedOption === '30' || storedOption === 'unlimited') {
      setTimerOption(storedOption);
    }
    if (storedOption === 'unlimited') {
      const storedReminder = window.localStorage.getItem('interviewTimerUnlimitedReminder');
      if (storedReminder) {
        const parsed = parseInt(storedReminder, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setUnlimitedReminderMinutes(parsed);
        }
      }
    }
    const storedSessionId = window.localStorage.getItem('activeInterviewSessionId');
    if (storedSessionId) {
      const parsedSessionId = parseInt(storedSessionId, 10);
      if (Number.isNaN(parsedSessionId)) {
        window.localStorage.removeItem('activeInterviewSessionId');
        return;
      }
      (async () => {
        try {
          const response = await fetch(`/api/interview/autosave?sessionId=${parsedSessionId}`);
          if (!response.ok) {
            if (response.status === 404) {
              window.localStorage.removeItem('activeInterviewSessionId');
            }
            return;
          }
          const payload = await response.json();
          if (payload?.snapshot) {
            setResumeSnapshot(payload.snapshot as AutosaveSnapshot);
          } else {
            window.localStorage.removeItem('activeInterviewSessionId');
          }
        } catch (fetchError) {
          console.warn('Failed to load autosave snapshot:', fetchError);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('interviewTimerOption', timerOption);
  }, [timerOption]);

  useEffect(() => {
    if (timerOption !== 'unlimited') {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('interviewTimerUnlimitedReminder', String(unlimitedReminderMinutes));
  }, [timerOption, unlimitedReminderMinutes]);

  const updateMessages = useCallback(
    (updater: (prev: InterviewMessage[]) => InterviewMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        const indexMap = new Map<string, number>();
        next.forEach((message, idx) => {
          indexMap.set(message.id, idx);
        });
        messageIndexRef.current = indexMap;
        return next;
      });
    },
    []
  );

  const updateMessageById = useCallback(
    (messageId: string, updater: (message: InterviewMessage) => InterviewMessage) => {
      updateMessages((prev) => {
        const index = prev.findIndex((message) => message.id === messageId);
        if (index === -1) {
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

  const clearReminderTimeout = useCallback(() => {
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current);
      reminderTimeoutRef.current = null;
    }
  }, []);

  const showReminder = useCallback(
    (message: string, analytics?: { event: string; data?: Record<string, unknown> }) => {
      clearReminderTimeout();
      setReminderMessage(message);
      reminderTimeoutRef.current = setTimeout(() => {
        setReminderMessage(null);
        reminderTimeoutRef.current = null;
      }, 9000);
      if (analytics) {
        fireAnalyticsEvent(analytics.event, analytics.data ?? {});
      }
    },
    [clearReminderTimeout]
  );

  const buildInitialQueue = useCallback((topics: TopicNode[]): QuestionQueueSnapshot => {
    const items: QuestionQueueItem[] = [];
    const walk = (nodes: TopicNode[]) => {
      nodes.forEach((node) => {
        if (node.targets && node.targets.length > 0) {
          node.targets.forEach((target) => {
            items.push({
              topicId: node.id,
              topicName: node.name,
              targetId: target.id,
              question: target.q,
              required: target.required,
              weight: node.weight ?? 1,
              status: 'pending',
            });
          });
        }
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
      });
    };
    walk(topics);
    items.sort((a, b) => {
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }
      if ((b.weight ?? 0) !== (a.weight ?? 0)) {
        return (b.weight ?? 0) - (a.weight ?? 0);
      }
      return a.question.localeCompare(b.question);
    });
    const [first, ...rest] = items;
    return {
      current: first ?? null,
      pending: rest,
      completed: [],
    };
  }, []);

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
          topicTreeRef.current = topicEntries;
          if (!pendingResume && !resumeSnapshot && !isRecording) {
            const currentQueue = queueStateRef.current;
            if (!currentQueue.current && currentQueue.pending.length === 0) {
              const nextQueue = buildInitialQueue(topicEntries);
              queueStateRef.current = nextQueue;
              setQueueState(nextQueue);
              setQuestionFeedback({});
            }
          }
        }
      }

      let initialCoverage: CoverageEntry[] = [];
      if (topicEntries.length > 0) {
        initialCoverage = topicEntries.slice(0, 4).map((topic) => ({
          topicId: topic.id,
          topicName: topic.name,
          coverage: 0,
          confidence: 0,
          nextQuestions: topic.targets?.map((target) => target.q).slice(0, 3) ?? [],
          evidence: [],
        }));
      }

      if (coverageRes.ok) {
        const coverageJson = await coverageRes.json();
        const metrics: CoverageEntry[] = (coverageJson?.metrics || []).map((metric: any) => ({
          topicId: metric.topicId,
          topicName: metric.topicName,
          coverage: metric.coveragePercent,
          confidence: metric.confidence,
          nextQuestions: metric.nextQuestions ?? [],
          evidence: metric.evidenceSummary ?? [],
        }));

        if (initialCoverage.length === 0) {
          initialCoverage = metrics.slice(0, 4);
        } else {
          initialCoverage = initialCoverage.map((entry) => {
            const match = metrics.find((metric) => metric.topicId === entry.topicId);
            return match
              ? {
                  ...entry,
                  coverage: match.coverage,
                  confidence: match.confidence,
                  nextQuestions: match.nextQuestions,
                  evidence: match.evidence,
                }
              : entry;
          });
        }
      }

      if (initialCoverage.length === 0) {
        initialCoverage = defaultCoverageTopics.map((topic) => ({
          topicId: topic.id,
          topicName: topic.name,
          coverage: 0,
          confidence: 0,
          nextQuestions: [],
          evidence: [],
        }));
      }

      setCoverageProgress(initialCoverage);
    } catch (error) {
      console.error('Failed to load topic context:', error);
      setCoverageProgress(
        defaultCoverageTopics.map((topic) => ({
          topicId: topic.id,
          topicName: topic.name,
          coverage: 0,
          confidence: 0,
          nextQuestions: [],
          evidence: [],
        }))
      );
    } finally {
      setCoverageLoading(false);
    }
  }, [buildInitialQueue, companyId, defaultCoverageTopics, isRecording, pendingResume, resumeSnapshot]);

  useEffect(() => {
    if (companyId) {
      loadTopicContext();
    } else {
      setCoverageProgress([]);
    }
  }, [companyId, loadTopicContext]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedName = window.localStorage.getItem('interviewSpeakerName');
    if (storedName) {
      setSpeakerName(storedName);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (speakerName) {
      window.localStorage.setItem('interviewSpeakerName', speakerName);
    } else {
      window.localStorage.removeItem('interviewSpeakerName');
    }
  }, [speakerName]);

  const evaluateReviewReasons = useCallback((content: string): string[] => {
    const reasons: string[] = [];
    if (content.length >= REVIEW_LENGTH_THRESHOLD && !PUNCTUATION_REGEX.test(content)) {
      reasons.push('long_no_punctuation');
    }
    if (REPEAT_CHAR_REGEX.test(content)) {
      reasons.push('repeated_characters');
    }
    if (EXCESSIVE_PUNCT_REGEX.test(content)) {
      reasons.push('excessive_punctuation');
    }
    return reasons;
  }, []);

  const registerReviewEntry = useCallback((messageId: string, reasons: string[]) => {
    if (reasons.length === 0) {
      return;
    }
    setReviewEntries((prev) => {
      const filtered = prev.filter((entry) => entry.messageId !== messageId);
      const nextEntry: ReviewEntry = {
        id: `${messageId}-review-${Date.now()}`,
        messageId,
        reasons,
        resolved: false,
        createdAt: Date.now(),
      };
      const next = [...filtered, nextEntry];
      next.sort((a, b) => a.createdAt - b.createdAt);
      reviewEntriesRef.current = next;
      fireAnalyticsEvent('interview_transcript_review_flagged', {
        sessionId: sessionIdRef.current ?? null,
        messageId,
        reasons,
      });
      return next;
    });
  }, []);

  const clearReviewEntry = useCallback((messageId: string, source: 'auto' | 'manual' = 'auto') => {
    setReviewEntries((prev) => {
      const next = prev.filter((entry) => entry.messageId !== messageId);
      if (next.length !== prev.length) {
        fireAnalyticsEvent('interview_transcript_review_cleared', {
          sessionId: sessionIdRef.current ?? null,
          messageId,
          source,
        });
      }
      reviewEntriesRef.current = next;
      return next;
    });
  }, []);

  const resolveReviewEntry = useCallback((entryId: string) => {
    setReviewEntries((prev) => {
      const target = prev.find((entry) => entry.id === entryId);
      if (!target) {
        return prev;
      }
      if (!target.resolved) {
        fireAnalyticsEvent('interview_transcript_review_resolved', {
          sessionId: sessionIdRef.current ?? null,
          messageId: target.messageId,
          reasons: target.reasons,
        });
      }
      const next = prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              resolved: true,
            }
          : entry
      );
      reviewEntriesRef.current = next;
      return next;
    });
  }, []);

  const createMessageId = useCallback((role: 'user' | 'assistant') => `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const shouldMergeMessages = useCallback(
    (prev: InterviewMessage | undefined, role: 'user' | 'assistant', timestamp: number, content: string) => {
      if (!prev) {
        return false;
      }
      if (prev.role !== role) {
        return false;
      }
      if (timestamp - prev.timestamp > MERGE_THRESHOLD_MS) {
        return false;
      }
      if ((prev.content.length + content.length) > MERGE_CHAR_LIMIT) {
        return false;
      }
      return true;
    },
    []
  );

  const addFinalMessage = useCallback(
    ({ id, role, content, confidence }: { id?: string; role: 'user' | 'assistant'; content: string; confidence?: number }) => {
      const timestamp = Date.now();
      const messageId = id ?? createMessageId(role);
      let reviewReasons: string[] = [];

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (shouldMergeMessages(last, role, timestamp, content)) {
          const mergedContent = `${last.content.trim()} ${content.trim()}`.replace(/\s+/g, ' ');
          last.content = mergedContent;
          last.timestamp = timestamp;
          if (confidence !== undefined) {
            last.confidence = confidence;
          }
          reviewReasons = evaluateReviewReasons(mergedContent);
          last.needsReview = reviewReasons.length > 0;
          last.reviewReasons = reviewReasons;
          return next;
        }

        reviewReasons = evaluateReviewReasons(content);
        const message: InterviewMessage = {
          id: messageId,
          role,
          content,
          timestamp,
          status: 'final',
          confidence,
          needsReview: reviewReasons.length > 0,
          reviewReasons,
        };
        next.push(message);
        return next;
      });

      if (reviewReasons.length > 0) {
        registerReviewEntry(messageId, reviewReasons);
      } else {
        clearReviewEntry(messageId, 'auto');
      }
    },
    [clearReviewEntry, createMessageId, evaluateReviewReasons, registerReviewEntry, shouldMergeMessages]
  );

  const upsertDraftMessage = useCallback((draftId: string, role: 'user' | 'assistant', content: string) => {
    const timestamp = Date.now();
    setDraftMessages((prev) => {
      const map = draftIndexRef.current;
      if (map.has(draftId)) {
        const index = map.get(draftId)!;
        const next = [...prev];
        next[index] = {
          ...next[index],
          content,
          timestamp,
          role,
          status: 'draft',
          needsReview: false,
          reviewReasons: [],
        };
        draftMessagesRef.current = next;
        return next;
      }
      const message: InterviewMessage = {
        id: draftId,
        role,
        content,
        timestamp,
        status: 'draft',
        needsReview: false,
        reviewReasons: [],
      };
      const next = [...prev, message];
      map.set(draftId, next.length - 1);
      draftMessagesRef.current = next;
      return next;
    });
  }, []);

  const finalizeDraftMessage = useCallback(
    (draftId: string, role: 'user' | 'assistant', content: string, options?: { confidence?: number }) => {
      setDraftMessages((prev) => {
        const map = draftIndexRef.current;
        if (!map.has(draftId)) {
          draftMessagesRef.current = prev;
          return prev;
        }
        const index = map.get(draftId)!;
        const next = [...prev];
        next.splice(index, 1);
        map.delete(draftId);
        next.forEach((_, idx) => {
          map.set(next[idx].id, idx);
        });
        draftMessagesRef.current = next;
        return next;
      });

      addFinalMessage({ id: draftId, role, content, confidence: options?.confidence });
    },
    [addFinalMessage]
  );

  const buildTimerAwareInstructions = useCallback(
    (baseInstructions: string, option: TimerOption, reminderMinutes: number | null) => {
      const trimmed = baseInstructions.trim();
      if (option.minutes !== null) {
        const line = formatTemplate(tInterview.timer.instructions.timeboxed, {
          minutes: String(option.minutes),
        });
        return `${trimmed}\n\n${line}`.trim();
      }
      if (reminderMinutes && reminderMinutes > 0) {
        const line = formatTemplate(tInterview.timer.instructions.unlimitedWithReminder, {
          minutes: String(reminderMinutes),
        });
        return `${trimmed}\n\n${line}`.trim();
      }
      return `${trimmed}\n\n${tInterview.timer.instructions.unlimited}`.trim();
    },
    [tInterview.timer.instructions]
  );

  const sendQueueUpdate = useCallback(() => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      return;
    }
    const snapshot = queueStateRef.current;
    const serializeItem = (item: QuestionQueueItem | null) =>
      item
        ? {
            topicId: item.topicId,
            topicName: item.topicName,
            targetId: item.targetId,
            question: item.question,
            required: item.required,
            status: item.status,
          }
        : null;
    const payload = {
      type: 'question_queue.update',
      queue: {
        current: serializeItem(snapshot.current),
        pending: snapshot.pending.slice(0, 5).map(serializeItem),
        completed: snapshot.completed.slice(-5).map(serializeItem),
      },
    };
    try {
      channel.send(JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to send question queue payload:', error);
    }
  }, []);

  useEffect(() => {
    queueStateRef.current = queueState;
    sendQueueUpdate();
  }, [queueState, sendQueueUpdate]);

  useEffect(() => {
    questionFeedbackRef.current = questionFeedback;
  }, [questionFeedback]);

  useEffect(() => {
    reviewEntriesRef.current = reviewEntries;
  }, [reviewEntries]);

  useEffect(() => {
    messagesRef.current = messages;
    const indexMap = new Map<string, number>();
    messages.forEach((message, idx) => {
      indexMap.set(message.id, idx);
    });
    messageIndexRef.current = indexMap;
  }, [messages]);

  useEffect(() => {
    draftMessagesRef.current = draftMessages;
    const map = draftIndexRef.current;
    map.clear();
    draftMessages.forEach((message, idx) => {
      map.set(message.id, idx);
    });
  }, [draftMessages]);

  const runAutosave = useCallback(
    async (reason: 'interval' | 'message' | 'coverage') => {
      if (!sessionIdRef.current) {
        return;
      }
      if (autosaveInFlightRef.current) {
        return;
      }
      const now = Date.now();
      if (reason !== 'interval' && now - lastAutosaveAtRef.current < AUTOSAVE_MIN_GAP_MS) {
        return;
      }
      autosaveInFlightRef.current = true;
      setAutosaveStatus('saving');
      setAutosaveError(null);
      try {
        const response = await fetch('/api/interview/autosave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            timerOption,
            secondsRemaining: timerSecondsRemaining,
            secondsElapsed: timerSecondsElapsed,
            extensionCount: timerExtensionCount,
            coverage: coverageProgress,
            messages: messagesRef.current,
            drafts: draftMessagesRef.current,
            reviews: reviewEntriesRef.current,
            queue: queueStateRef.current,
            feedback: questionFeedbackRef.current,
            updatedAt: new Date().toISOString(),
          }),
        });
        if (!response.ok) {
          let message = 'Autosave failed';
          try {
            const payload = await response.json();
            if (payload?.error) {
              message = payload.error;
            }
          } catch (parseError) {
            // ignore parsing errors
          }
          throw new Error(message);
        }
        lastAutosaveAtRef.current = now;
        setAutosaveStatus('idle');
      } catch (autosaveErr) {
        console.error('Autosave error:', autosaveErr);
        setAutosaveStatus('error');
        setAutosaveError(
          autosaveErr instanceof Error ? autosaveErr.message : tInterview.timer.autosaveFallbackError
        );
      } finally {
        autosaveInFlightRef.current = false;
      }
    },
    [
      coverageProgress,
      timerExtensionCount,
      timerOption,
      timerSecondsElapsed,
      timerSecondsRemaining,
      tInterview.timer.autosaveFallbackError,
    ]
  );

  const handleAzureRecognizing = useCallback(
    (result: SpeechRecognitionResult) => {
      if (!result) {
        return;
      }
      const text = result.text?.trim();
      if (!text) {
        return;
      }
      const draftId = result.resultId;
      azureDraftIdRef.current = draftId;
      upsertDraftMessage(draftId, 'user', text);
    },
    [upsertDraftMessage]
  );

  const handleAzureRecognized = useCallback(
    (result: SpeechRecognitionResult) => {
      if (!result) {
        return;
      }
      const text = result.text?.trim();
      const draftId = result.resultId;
      if (!text) {
        azureDraftIdRef.current = null;
        return;
      }
      finalizeDraftMessage(draftId, 'user', text);
      runAutosave('message');
      azureDraftIdRef.current = null;
    },
    [finalizeDraftMessage, runAutosave]
  );

  const handleAzureError = useCallback(
    (error: Error) => {
      console.error('Azure speech error:', error);
      setError((prev) => prev || formatTemplate(tInterview.errors.transcription, { message: error.message }));
    },
    [tInterview.errors.transcription]
  );

  const { start: startAzureRecognition, stop: stopAzureRecognition } = useAzureSpeechRecognizer({
    enabled: isAzureTranscription,
    locale,
    onRecognizing: handleAzureRecognizing,
    onRecognized: handleAzureRecognized,
    onError: handleAzureError,
  });

  useEffect(() => {
    if (!isRecording || !sessionIdRef.current) {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
      return;
    }
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current);
    }
    autosaveIntervalRef.current = setInterval(() => {
      runAutosave('interval');
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
    };
  }, [isRecording, runAutosave]);

  useEffect(() => {
    if (!isRecording || !sessionIdRef.current) {
      return;
    }
    runAutosave('coverage');
  }, [coverageProgress, isRecording, runAutosave]);

  const resetTimerForOption = useCallback(() => {
    if (selectedTimer.minutes !== null) {
      setTimerSecondsRemaining(selectedTimer.minutes * 60);
    } else {
      setTimerSecondsRemaining(null);
    }
    setTimerSecondsElapsed(0);
    setTimerExtensionCount(0);
    setWrapUpModalOpen(false);
    setWrapUpAutoDeadline(null);
    wrapUpTriggeredRef.current = false;
    lastReminderAtRef.current = null;
    clearReminderTimeout();
    setReminderMessage(null);
  }, [clearReminderTimeout, selectedTimer.minutes]);

  useEffect(() => {
    if (isRecording || pendingResume) {
      return;
    }
    resetTimerForOption();
  }, [isRecording, pendingResume, resetTimerForOption, timerOption]);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (wrapUpTimeoutRef.current) {
      clearTimeout(wrapUpTimeoutRef.current);
      wrapUpTimeoutRef.current = null;
    }
    wrapUpTriggeredRef.current = false;
    setWrapUpModalOpen(false);
    setWrapUpAutoDeadline(null);
    activeSessionStartedAtRef.current = null;
    lastReminderAtRef.current = null;
    clearReminderTimeout();
    setReminderMessage(null);
    pendingTimerConfigRef.current = null;
    if (isAzureTranscription) {
      stopAzureRecognition();
      azureDraftIdRef.current = null;
    }
  }, [clearReminderTimeout, isAzureTranscription, stopAzureRecognition]);

  const startTimer = useCallback((initialRemaining: number | null, initialElapsed: number, extensionCount = 0) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    wrapUpTriggeredRef.current = false;
    lastReminderAtRef.current = null;
    activeSessionStartedAtRef.current = Date.now() - initialElapsed * 1000;
    setTimerSecondsRemaining(initialRemaining);
    setTimerSecondsElapsed(initialElapsed);
    setTimerExtensionCount(extensionCount);
    timerIntervalRef.current = setInterval(() => {
      setTimerSecondsElapsed((prev) => prev + 1);
      setTimerSecondsRemaining((prev) => {
        if (prev === null) {
          return null;
        }
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
  }, []);

  const extendTimer = useCallback(() => {
    setTimerSecondsRemaining((prev) => {
      if (prev === null) {
        return null;
      }
      return prev > 0 ? prev + 300 : 300;
    });
    setTimerExtensionCount((prev) => {
      const next = prev + 1;
      fireAnalyticsEvent('interview_timer_extended', { count: next });
      return next;
    });
    wrapUpTriggeredRef.current = false;
    setWrapUpModalOpen(false);
    setWrapUpAutoDeadline(null);
    if (wrapUpTimeoutRef.current) {
      clearTimeout(wrapUpTimeoutRef.current);
      wrapUpTimeoutRef.current = null;
    }
    clearReminderTimeout();
  }, [clearReminderTimeout]);

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
    const sessionConfig: any = {
      modalities: ['text', 'audio'],
      voice: meta?.voice ?? 'verse',
      instructions: meta?.instructions ?? instructionsFallback,
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
      metadata: {
        queue: {
          current: queueStateRef.current.current
            ? {
                topicId: queueStateRef.current.current.topicId,
                targetId: queueStateRef.current.current.targetId,
                question: queueStateRef.current.current.question,
                required: queueStateRef.current.current.required,
              }
            : null,
          pending: queueStateRef.current.pending.slice(0, 5).map((item) => ({
            topicId: item.topicId,
            targetId: item.targetId,
            question: item.question,
            required: item.required,
          })),
        },
      },
    };

    if (!isAzureTranscription) {
      sessionConfig.input_audio_transcription = {
        model: TRANSCRIPTION_MODEL,
        language: transcriptionLanguage,
      };
    }

    const payload = {
      type: 'session.update',
      session: sessionConfig,
    };

    channel.send(JSON.stringify(payload));
    sendQueueUpdate();
  }, [instructionsFallback, isAzureTranscription, sendQueueUpdate, transcriptionLanguage]);

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
                coverage: Math.max(next[existingIndex].coverage, Math.max(0, Math.min(100, coverageValue))),
                confidence: Math.max(next[existingIndex].confidence, Math.max(0, Math.min(100, confidenceValue))),
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
                nextQuestions: [],
                evidence: [],
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

        const ensureAssistantDraftId = (responseId?: string, itemId?: string) => {
          let draftId: string | undefined;
          if (itemId) {
            draftId = assistantItemDraftRef.current.get(itemId);
          }
          if (!draftId && responseId) {
            draftId = assistantResponseDraftRef.current.get(responseId);
          }
          if (!draftId) {
            draftId = itemId ?? responseId ?? createMessageId('assistant');
          }
          if (itemId) {
            assistantItemDraftRef.current.set(itemId, draftId);
          }
          if (responseId) {
            assistantResponseDraftRef.current.set(responseId, draftId);
          }
          return draftId;
        };

        const ensureAssistantDraft = (responseId?: string, itemId?: string, initialContent?: string) => {
          const draftId = ensureAssistantDraftId(responseId, itemId);
          if (initialContent !== undefined) {
            upsertDraftMessage(draftId, 'assistant', initialContent);
          } else if (!draftIndexRef.current.has(draftId)) {
            upsertDraftMessage(draftId, 'assistant', '');
          }
          return draftId;
        };

        const handleAssistantDelta = (delta: string, responseId?: string, itemId?: string) => {
          if (!delta) {
            return;
          }
          const draftId = ensureAssistantDraft(responseId, itemId);
          const index = draftIndexRef.current.get(draftId);
          const currentContent =
            typeof index === 'number' ? draftMessagesRef.current[index]?.content ?? '' : '';
          upsertDraftMessage(draftId, 'assistant', `${currentContent}${delta}`);
        };

        const handleAssistantFinal = (text: string, responseId?: string, itemId?: string) => {
          const draftId = ensureAssistantDraftId(responseId, itemId);
          const index = draftIndexRef.current.get(draftId);
          const fallback =
            typeof index === 'number' ? draftMessagesRef.current[index]?.content ?? '' : '';
          const candidate = (text ?? '').length > 0 ? text ?? '' : fallback;
          if (!candidate.trim()) {
            return;
          }
          finalizeDraftMessage(draftId, 'assistant', candidate);
          if (itemId) {
            assistantItemDraftRef.current.delete(itemId);
          }
          if (responseId) {
            assistantResponseDraftRef.current.delete(responseId);
          }
          runAutosave('message');
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
            const message = payload?.error?.message || tInterview.errors.session;
            setError(message);
            return;
          }
          case 'conversation.item.input_audio_transcription.delta': {
            const transcript: string = (payload?.delta ?? '').trim();
            if (!transcript) return;
            const itemId: string | undefined = payload?.item_id;
            if (!itemId || isAzureTranscription) {
              return;
            }
            markActiveSpeaker('user');
            userItemDraftRef.current.set(itemId, itemId);
            upsertDraftMessage(itemId, 'user', transcript);
            return;
          }
          case 'conversation.item.input_audio_transcription.completed': {
            const transcript: string = (payload?.transcript ?? '').trim();
            if (!transcript) return;
            const itemId: string | undefined = payload?.item_id;
            if (!itemId || isAzureTranscription) {
              return;
            }
            markActiveSpeaker('user');
            userItemDraftRef.current.delete(itemId);
            finalizeDraftMessage(itemId, 'user', transcript);
            runAutosave('message');
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
              ensureAssistantDraft(undefined, item.id, text ? text : undefined);
              if (text) {
                markActiveSpeaker('assistant');
              }
            } else if (item.role === 'user') {
              if (isAzureTranscription) {
                return;
              }
              const textFromItem = (item.content || [])
                .filter((part: any) => part?.type === 'text' && part?.text)
                .map((part: any) => part.text)
                .join('');
              let finalText = textFromItem;
              if (!finalText) {
                const draftIndex = draftIndexRef.current.get(item.id);
                if (typeof draftIndex === 'number') {
                  finalText = draftMessagesRef.current[draftIndex]?.content ?? '';
                }
              }
              if (!finalText.trim()) {
                return;
              }
              if (messageIndexRef.current.has(item.id)) {
                return;
              }
              markActiveSpeaker('user');
              userItemDraftRef.current.delete(item.id);
              finalizeDraftMessage(item.id, 'user', finalText);
              runAutosave('message');
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
              ensureAssistantDraft(responseId, item.id, text ? text : undefined);
              if (text) {
                markActiveSpeaker('assistant');
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
            const draftId = assistantResponseDraftRef.current.get(responseId);
            if (draftId && messageIndexRef.current.has(draftId)) {
              updateMessageById(draftId, (message) => ({
                ...message,
                timestamp: Date.now(),
              }));
            }
            assistantResponseDraftRef.current.delete(responseId);
            return;
          }
          default:
            return;
        }
      } catch (err) {
        console.error('Failed to process realtime event:', err, event.data);
      }
  },
    [createMessageId, finalizeDraftMessage, handleFunctionCall, isAzureTranscription, markActiveSpeaker, runAutosave, tInterview, upsertDraftMessage, updateMessageById]
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
    if (isAzureTranscription) {
      stopAzureRecognition();
      azureDraftIdRef.current = null;
    }
    assistantResponseDraftRef.current.clear();
    assistantItemDraftRef.current.clear();
    userItemDraftRef.current.clear();
    draftMessagesRef.current = [];
    draftIndexRef.current.clear();
  }, [isAzureTranscription, stopAzureRecognition, stopLevelMonitoring]);

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

    formData.append('locale', locale);

    const response = await fetch('/api/interview/end', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(tInterview.errors.audioTooLarge);
      }
      const payload = await safeParseJson(response);
      throw new Error(payload?.error || tInterview.errors.persistFailed);
    }

    return true;
  }, [locale, tInterview.errors.audioTooLarge, tInterview.errors.persistFailed]);

  const resetInterviewState = useCallback(() => {
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
      activeSpeakerTimeoutRef.current = null;
    }
    stopTimer();
    if (isAzureTranscription) {
      stopAzureRecognition();
      azureDraftIdRef.current = null;
    }
    setMessages([]);
    messagesRef.current = [];
    messageIndexRef.current.clear();
    setDraftMessages([]);
    draftMessagesRef.current = [];
    draftIndexRef.current.clear();
    setReviewEntries([]);
    reviewEntriesRef.current = [];
    assistantResponseDraftRef.current.clear();
    assistantItemDraftRef.current.clear();
    userItemDraftRef.current.clear();
    azureDraftIdRef.current = null;
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
    setReminderMessage(null);
    setAutosaveStatus('idle');
    setAutosaveError(null);
    setPendingResume(false);
  }, [isAzureTranscription, stopAzureRecognition, stopLevelMonitoring, stopTimer]);

  const prepareResumeSession = useCallback(() => {
    if (!resumeSnapshot) {
      return;
    }
    const snapshotMinutes = TIMER_OPTIONS.find((option) => option.id === resumeSnapshot.timerOption)?.minutes ?? null;
    setPendingResume(true);
    setTimerOption(resumeSnapshot.timerOption);
    setAutosaveStatus('idle');
    setAutosaveError(null);
    fireAnalyticsEvent('interview_resume_prepared', {
      sessionId: resumeSnapshot.sessionId,
      timerOption: resumeSnapshot.timerOption,
    });
    if (resumeSnapshot.timerOption !== 'unlimited') {
      setTimerSecondsRemaining(
        typeof resumeSnapshot.secondsRemaining === 'number'
          ? Math.max(resumeSnapshot.secondsRemaining, 0)
          : snapshotMinutes !== null
          ? snapshotMinutes * 60
          : null
      );
    } else {
      setTimerSecondsRemaining(null);
    }
    setTimerSecondsElapsed(resumeSnapshot.secondsElapsed);
    setTimerExtensionCount(resumeSnapshot.extensionCount);
    setMessages(resumeSnapshot.messages);
    messagesRef.current = resumeSnapshot.messages;
    const messageIndex = new Map<string, number>();
    resumeSnapshot.messages.forEach((message, idx) => {
      messageIndex.set(message.id, idx);
    });
    messageIndexRef.current = messageIndex;
    const drafts = Array.isArray(resumeSnapshot.drafts) ? resumeSnapshot.drafts : [];
    setDraftMessages(drafts);
    draftMessagesRef.current = drafts;
    draftIndexRef.current.clear();
    drafts.forEach((message, idx) => {
      draftIndexRef.current.set(message.id, idx);
    });
    const reviews = Array.isArray(resumeSnapshot.reviews) ? resumeSnapshot.reviews : [];
    setReviewEntries(reviews);
    reviewEntriesRef.current = reviews;
    setCoverageProgress(
      resumeSnapshot.coverage.map((entry) => ({
        ...entry,
        nextQuestions: entry.nextQuestions ?? [],
        evidence: entry.evidence ?? [],
      }))
    );
    if (resumeSnapshot.queue) {
      setQueueState(resumeSnapshot.queue);
    } else if (topicTreeRef.current.length > 0) {
      const nextQueue = buildInitialQueue(topicTreeRef.current);
      setQueueState(nextQueue);
    }
    if (resumeSnapshot.feedback) {
      setQuestionFeedback(resumeSnapshot.feedback);
    }
    sessionIdRef.current = resumeSnapshot.sessionId;
    setSessionId(resumeSnapshot.sessionId);
    lastAutosaveAtRef.current = Date.now();
    pendingTimerConfigRef.current = {
      remaining:
        resumeSnapshot.timerOption === 'unlimited'
          ? null
          : typeof resumeSnapshot.secondsRemaining === 'number'
          ? Math.max(resumeSnapshot.secondsRemaining, 0)
          : snapshotMinutes !== null
          ? snapshotMinutes * 60
          : null,
      elapsed: resumeSnapshot.secondsElapsed,
      extensionCount: resumeSnapshot.extensionCount,
    };
  }, [buildInitialQueue, resumeSnapshot, setCoverageProgress, setMessages]);

  const discardResumeSnapshot = useCallback(async () => {
    if (!resumeSnapshot) {
      return;
    }
    fireAnalyticsEvent('interview_resume_discarded', {
      sessionId: resumeSnapshot.sessionId,
    });
    try {
      await fetch('/api/interview/autosave', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: resumeSnapshot.sessionId }),
      });
    } catch (error) {
      console.warn('Failed to discard autosave snapshot:', error);
    } finally {
      setResumeSnapshot(null);
      setPendingResume(false);
      resetTimerForOption();
      setSessionId(null);
      sessionIdRef.current = null;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeInterviewSessionId');
      }
      if (topicTreeRef.current.length > 0) {
        const nextQueue = buildInitialQueue(topicTreeRef.current);
        queueStateRef.current = nextQueue;
        setQueueState(nextQueue);
      } else {
        const emptyQueue: QuestionQueueSnapshot = { current: null, pending: [], completed: [] };
        queueStateRef.current = emptyQueue;
        setQueueState(emptyQueue);
      }
      setQuestionFeedback({});
    }
  }, [buildInitialQueue, resetTimerForOption, resumeSnapshot]);

  const handleTimerOptionChange = useCallback(
    (optionId: TimerOptionId) => {
      if (isRecording || isConnecting) {
        return;
      }
      if (timerOption === optionId) {
        return;
      }
      fireAnalyticsEvent('interview_timer_selected', {
        option: optionId,
      });
      setTimerOption(optionId);
    },
    [isConnecting, isRecording, timerOption]
  );

  const handleUnlimitedReminderChange = useCallback((minutes: number) => {
    if (minutes <= 0) {
      setUnlimitedReminderMinutes(0);
      fireAnalyticsEvent('interview_timer_reminder_updated', { minutes: 0 });
      return;
    }
    fireAnalyticsEvent('interview_timer_reminder_updated', { minutes });
    setUnlimitedReminderMinutes(minutes);
  }, []);

  const startInterview = useCallback(async () => {
    if (isConnecting || isRecording) {
      return;
    }

    if (!companyId) {
      setError(tInterview.errors.missingCompany);
      return;
    }

    const snapshot = pendingResume && resumeSnapshot ? resumeSnapshot : null;

    setError('');
    setIsConnecting(true);
    setStatus('connecting');
    setPostSessionInfo(null);
    if (!snapshot) {
      setSessionId(null);
      sessionIdRef.current = null;
    }
    setStopPending(false);
    if (!snapshot) {
      setMessages([]);
      messagesRef.current = [];
      messageIndexRef.current.clear();
      setDraftMessages([]);
      draftMessagesRef.current = [];
      draftIndexRef.current.clear();
      setReviewEntries([]);
      reviewEntriesRef.current = [];
    }
    assistantResponseDraftRef.current.clear();
    assistantItemDraftRef.current.clear();
    userItemDraftRef.current.clear();
    azureDraftIdRef.current = null;
    functionCallBuffersRef.current.clear();

    try {
      const fallbackRemaining = selectedTimer.minutes !== null ? selectedTimer.minutes * 60 : null;
      const initialRemaining =
        selectedTimer.minutes !== null
          ? snapshot && typeof snapshot.secondsRemaining === 'number'
            ? Math.max(snapshot.secondsRemaining, 0)
            : fallbackRemaining
          : null;
      const initialElapsed = snapshot ? Math.max(snapshot.secondsElapsed, 0) : 0;
      const initialExtension = snapshot ? Math.max(snapshot.extensionCount, 0) : 0;
      pendingTimerConfigRef.current = {
        remaining: initialRemaining,
        elapsed: initialElapsed,
        extensionCount: initialExtension,
      };
      lastAutosaveAtRef.current = 0;
      setAutosaveStatus('idle');
      setAutosaveError(null);
      if (snapshot) {
        setTimerSecondsRemaining(initialRemaining);
        setTimerSecondsElapsed(initialElapsed);
        setTimerExtensionCount(initialExtension);
      } else {
        setTimerSecondsElapsed(0);
        setTimerExtensionCount(0);
      }

      if (companyId && !snapshot) {
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
        body: JSON.stringify({
          companyId,
          speakerName: speakerName.trim() || undefined,
          locale,
          resumeSessionId: snapshot?.sessionId ?? undefined,
        }),
      });

      if (!response.ok) {
        const payload = await safeParseJson(response);
        throw new Error(payload?.error || tInterview.errors.startFailed);
      }

      const data = (await response.json()) as RealtimeSessionPayload;
      if (!data?.clientSecret || !data.webrtcUrl) {
        throw new Error(tInterview.errors.realtimeCredentials);
      }

      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('activeInterviewSessionId', String(data.sessionId));
      }
      sessionConfigRef.current = {
        voice: data.voice ?? 'verse',
        instructions: buildTimerAwareInstructions(
          data.instructions ?? instructionsFallback,
          selectedTimer,
          selectedTimer.id === 'unlimited' ? unlimitedReminderMinutes : selectedTimer.minutes
        ),
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
          const timerConfig =
            pendingTimerConfigRef.current ??
            {
              remaining: selectedTimer.minutes !== null ? selectedTimer.minutes * 60 : null,
              elapsed: 0,
              extensionCount: 0,
            };
          startTimer(timerConfig.remaining ?? null, timerConfig.elapsed, timerConfig.extensionCount);
          pendingTimerConfigRef.current = null;
          setPendingResume(false);
          setResumeSnapshot(null);
          runAutosave('message');
          fireAnalyticsEvent('interview_timer_started', {
            sessionId: sessionIdRef.current,
            option: timerOption,
            secondsRemaining: timerConfig.remaining,
            secondsElapsed: timerConfig.elapsed,
            resume: Boolean(snapshot),
          });
          if (isAzureTranscription) {
            startAzureRecognition().catch((error) => {
              console.error('Failed to start Azure speech recognizer:', error);
            });
          }
        }
        if (peerConnection.connectionState === 'failed') {
          setError(tInterview.connection.dropped);
          if (isAzureTranscription) {
            stopAzureRecognition();
          }
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
        throw new Error(text || tInterview.errors.realtimeOfferRejected);
      }

      const answer = await sdpResponse.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });

      setIsConnecting(false);
    } catch (err) {
      console.error('Interview start error:', err);
      setError(err instanceof Error ? err.message : tInterview.errors.startFailed);
      setIsConnecting(false);
      setStatus('idle');
      stopTimer();
      pendingTimerConfigRef.current = snapshot
        ? {
            remaining:
              snapshot.timerOption === 'unlimited'
                ? null
                : typeof snapshot.secondsRemaining === 'number'
                ? Math.max(snapshot.secondsRemaining, 0)
                : selectedTimer.minutes !== null
                ? selectedTimer.minutes * 60
                : null,
            elapsed: snapshot.secondsElapsed,
            extensionCount: snapshot.extensionCount,
          }
        : null;
      if (snapshot) {
        setPendingResume(true);
        setResumeSnapshot(snapshot);
        sessionIdRef.current = snapshot.sessionId;
        setSessionId(snapshot.sessionId);
      }
      if (!snapshot && typeof window !== 'undefined') {
        window.localStorage.removeItem('activeInterviewSessionId');
      }
      cleanupConnection();
    }
  }, [
    cleanupConnection,
    companyId,
    handleServerEvent,
    instructionsFallback,
    isConnecting,
    isRecording,
    loadTopicContext,
    locale,
    pendingResume,
    resumeSnapshot,
    runAutosave,
    selectedTimer,
    sendSessionBootstrap,
    setupAnalyserForStream,
    startTimer,
    stopTimer,
    tInterview,
    isAzureTranscription,
    startAzureRecognition,
    stopAzureRecognition,
    buildTimerAwareInstructions,
    speakerName,
    unlimitedReminderMinutes,
    timerOption,
  ]);

  const stopInterview = useCallback(async () => {
    stopTimer();
    if (!sessionIdRef.current) {
      cleanupConnection();
      setIsRecording(false);
      setStatus('ended');
      return;
    }

    setStopPending(true);
    setIsRecording(false);
    setStatus('ended');

    const finishingSessionId = sessionIdRef.current;

    fireAnalyticsEvent('interview_timer_stopped', {
      sessionId: finishingSessionId ?? null,
      secondsElapsed: timerSecondsElapsed,
      option: timerOption,
      extensions: timerExtensionCount,
    });

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
      setError(err instanceof Error ? err.message : tInterview.errors.persistFailed);
    } finally {
      if (finishingSessionId) {
        try {
          await fetch('/api/interview/autosave', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: finishingSessionId }),
          });
        } catch (error) {
          console.warn('Failed to clear autosave snapshot:', error);
        }
      }
      cleanupConnection();
      sessionIdRef.current = null;
      setSessionId(null);
      setStopPending(false);
      setResumeSnapshot(null);
      setPendingResume(false);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeInterviewSessionId');
      }
    }
  }, [
    cleanupConnection,
    companyId,
    finalizeRecording,
    persistSession,
    stopTimer,
    tInterview.errors.persistFailed,
    timerExtensionCount,
    timerOption,
    timerSecondsElapsed,
  ]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }
    if (timerOption === 'unlimited') {
      if (unlimitedReminderMinutes <= 0) {
        return;
      }
      const intervalSeconds = unlimitedReminderMinutes * 60;
      if (intervalSeconds <= 0) {
        return;
      }
      const previousCount = typeof lastReminderAtRef.current === 'number' && lastReminderAtRef.current >= 0 ? lastReminderAtRef.current : 0;
      const currentCount = Math.floor(timerSecondsElapsed / intervalSeconds);
      if (currentCount > 0 && currentCount > previousCount) {
        lastReminderAtRef.current = currentCount;
        showReminder(
          formatTemplate(tInterview.timer.reminders.unlimited, {
            minutes: String(unlimitedReminderMinutes),
          }),
          {
            event: 'interview_timer_reminder',
            data: {
              mode: 'unlimited',
              intervalMinutes: unlimitedReminderMinutes,
              occurrence: currentCount,
              sessionId: sessionIdRef.current ?? null,
            },
          }
        );
      }
      return;
    }

    if (timerSecondsRemaining === null) {
      return;
    }

    if (timerSecondsRemaining <= 0) {
      if (!wrapUpTriggeredRef.current) {
        wrapUpTriggeredRef.current = true;
        setWrapUpModalOpen(true);
        const deadline = Date.now() + 60_000;
        setWrapUpAutoDeadline(deadline);
        if (wrapUpTimeoutRef.current) {
          clearTimeout(wrapUpTimeoutRef.current);
        }
        wrapUpTimeoutRef.current = setTimeout(() => {
          stopInterview();
        }, 60_000);
        showReminder(tInterview.timer.reminders.autowrap, {
          event: 'interview_timer_autowrap',
          data: {
            sessionId: sessionIdRef.current ?? null,
          },
        });
      }
      return;
    }

    if (wrapUpTriggeredRef.current) {
      wrapUpTriggeredRef.current = false;
      setWrapUpModalOpen(false);
      setWrapUpAutoDeadline(null);
      if (wrapUpTimeoutRef.current) {
        clearTimeout(wrapUpTimeoutRef.current);
        wrapUpTimeoutRef.current = null;
      }
    }

    if (timerSecondsRemaining <= 60 && lastReminderAtRef.current !== 60) {
      lastReminderAtRef.current = 60;
      showReminder(tInterview.timer.reminders.oneMinute, {
        event: 'interview_timer_warning',
        data: { thresholdSeconds: 60, sessionId: sessionIdRef.current ?? null },
      });
    } else if (timerSecondsRemaining <= 120 && lastReminderAtRef.current !== 120) {
      lastReminderAtRef.current = 120;
      showReminder(tInterview.timer.reminders.twoMinutes, {
        event: 'interview_timer_warning',
        data: { thresholdSeconds: 120, sessionId: sessionIdRef.current ?? null },
      });
    } else if (timerSecondsRemaining <= 300 && lastReminderAtRef.current !== 300) {
      lastReminderAtRef.current = 300;
      showReminder(tInterview.timer.reminders.fiveMinutes, {
        event: 'interview_timer_warning',
        data: { thresholdSeconds: 300, sessionId: sessionIdRef.current ?? null },
      });
    }
  }, [
    isRecording,
    showReminder,
    stopInterview,
    tInterview.timer.reminders,
    timerOption,
    timerSecondsElapsed,
    timerSecondsRemaining,
    unlimitedReminderMinutes,
  ]);

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupConnection();
    };
  }, [cleanupConnection, stopTimer]);

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [draftMessages, messages]);

  useEffect(() => {
    return () => {
      if (activeSpeakerTimeoutRef.current) {
        clearTimeout(activeSpeakerTimeoutRef.current);
      }
    };
  }, []);

  const statusLabel = tInterview.status[status];

  const heroDescription = companyName
    ? formatTemplate(tInterview.hero.descriptionWithCompany, { company: companyName })
    : tInterview.hero.description;
  const timerBadge = useMemo(() => {
    if (timerOption === 'unlimited') {
      return {
        label: tInterview.timer.elapsedLabel,
        value: formatSeconds(timerSecondsElapsed),
        tone: 'neutral' as const,
      };
    }
    const fallbackRemaining = selectedTimer.minutes !== null ? selectedTimer.minutes * 60 : 0;
    const remaining = typeof timerSecondsRemaining === 'number' ? timerSecondsRemaining : fallbackRemaining;
    let tone: 'neutral' | 'warning' | 'danger' = 'neutral';
    if (remaining <= 60) {
      tone = 'danger';
    } else if (remaining <= 300) {
      tone = 'warning';
    }
    return {
      label: tInterview.timer.remainingLabel,
      value: formatSeconds(remaining),
      tone,
    };
  }, [selectedTimer.minutes, tInterview.timer, timerOption, timerSecondsElapsed, timerSecondsRemaining]);
  const autoWrapCountdown = wrapUpAutoDeadline
    ? Math.max(0, Math.ceil((wrapUpAutoDeadline - Date.now()) / 1000))
    : null;
  const currentQuestion = queueState.current;
  const pendingQuestions = queueState.pending;
  const completedQuestions = queueState.completed;
  const reviewStatusByMessageId = useMemo(() => {
    const map = new Map<string, 'pending' | 'resolved'>();
    reviewEntries.forEach((entry) => {
      map.set(entry.messageId, entry.resolved ? 'resolved' : 'pending');
    });
    return map;
  }, [reviewEntries]);
  const transcriptMessages = useMemo(() => {
    if (transcriptView === 'final') {
      return messages;
    }
    return [...messages, ...draftMessages];
  }, [draftMessages, messages, transcriptView]);
  const draftCount = draftMessages.length;
  const hasDrafts = draftCount > 0;

  const handleMarkCurrentAnswered = useCallback(() => {
    setQueueState((prev) => {
      if (!prev.current) {
        return prev;
      }
      const current = prev.current;
      fireAnalyticsEvent('interview_queue_mark_answered', {
        targetId: current.targetId,
        topicId: current.topicId,
        sessionId: sessionIdRef.current ?? null,
      });
      const completedEntry: QuestionQueueItem = { ...current, status: 'answered' };
      const [next, ...rest] = prev.pending;
      return {
        current: next ?? null,
        pending: rest,
        completed: [...prev.completed, completedEntry],
      };
    });
  }, []);

  const handleSkipCurrent = useCallback(() => {
    setQueueState((prev) => {
      if (!prev.current) {
        return prev;
      }
      const current = prev.current;
      fireAnalyticsEvent('interview_queue_skipped', {
        targetId: current.targetId,
        topicId: current.topicId,
        sessionId: sessionIdRef.current ?? null,
      });
      const skipped: QuestionQueueItem = { ...current, status: 'skipped' };
      const [next, ...rest] = prev.pending;
      return {
        current: next ?? null,
        pending: [...rest, skipped],
        completed: prev.completed,
      };
    });
  }, []);

  const handleQuestionFeedback = useCallback(
    (targetId: string, rating: 'up' | 'down') => {
      if (!sessionIdRef.current) {
        return;
      }
      setQuestionFeedback((prev) => {
        const next = { ...prev, [targetId]: rating };
        return next;
      });
      fireAnalyticsEvent('interview_queue_feedback', {
        targetId,
        rating,
        sessionId: sessionIdRef.current,
      });
      fetch('/api/interview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          targetId,
          rating,
        }),
      }).catch((error) => console.warn('Feedback submit failed:', error));
    },
    []
  );

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
      <section className="section-surface p-8">
        <div className="flex flex-col gap-4">
          <span className="badge-soft">{tInterview.hero.badge}</span>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{tInterview.hero.title}</h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{heroDescription}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {tInterview.form.speakerLabel}
            </label>
            <input
              type="text"
              value={speakerName}
              onChange={(event) => setSpeakerName(event.target.value)}
              placeholder={tInterview.form.speakerPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-64"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={statusLabel} status={status} />
            <TimerPill
              label={timerBadge.label}
              value={timerBadge.value}
              tone={timerBadge.tone}
              isActive={isRecording}
              autoWrapSeconds={autoWrapCountdown}
              texts={tInterview.timer}
            />
            {companyId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                <span aria-hidden="true">✓</span>
                {formatTemplate(tInterview.hero.companyReady, { id: String(companyId) })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
                <span aria-hidden="true">!</span>
                {tInterview.hero.companyMissing}
              </span>
            )}
            {sessionId && (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                {formatTemplate(tInterview.hero.sessionLabel, { id: String(sessionId) })}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <section className="section-surface p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isRecording ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  {tInterview.connection.recording}
                </div>
              ) : isConnecting ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                  {tInterview.connection.connecting}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  {tInterview.connection.ready}
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
                    <Spinner /> {tInterview.buttons.stopPending}
                  </span>
                ) : (
                  tInterview.buttons.stop
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
                    <Spinner /> {tInterview.buttons.startPending}
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
                    {tInterview.buttons.start}
                  </span>
                )}
              </button>
            )}
            <div className="mt-2 text-xs text-slate-400">
              {autosaveStatus === 'saving'
                ? tInterview.timer.autosaveSaving
                : autosaveStatus === 'error'
                ? tInterview.timer.autosaveError
                : tInterview.timer.autosaveIdle}
              {autosaveStatus === 'error' && autosaveError ? (
                <button
                  type="button"
                  className="ml-2 underline transition hover:text-slate-600"
                  onClick={() => runAutosave('message')}
                >
                  {tInterview.timer.autosaveRetry}
                </button>
              ) : null}
            </div>
          </div>

          {resumeSnapshot && !pendingResume ? (
            <ResumeBanner
              snapshot={resumeSnapshot}
              texts={tInterview.timer.resume}
              onResume={prepareResumeSession}
              onDiscard={discardResumeSnapshot}
            />
          ) : null}

          <TimerSelector
            option={timerOption}
            onChange={handleTimerOptionChange}
            optionTexts={tInterview.timer.options}
            disabled={isRecording || isConnecting}
            unlimitedReminderMinutes={unlimitedReminderMinutes}
            onReminderChange={handleUnlimitedReminderChange}
            showReminderPicker={timerOption === 'unlimited'}
            pendingResume={pendingResume}
          reminderTexts={tInterview.timer.unlimitedReminder}
        />

        <CurrentQuestionCard
          question={currentQuestion}
          pendingCount={pendingQuestions.length}
          onMarkAnswered={handleMarkCurrentAnswered}
          onSkip={handleSkipCurrent}
            onFeedback={handleQuestionFeedback}
            feedback={currentQuestion ? questionFeedback[currentQuestion.targetId] ?? null : null}
            texts={tInterview.queue}
          />

          <QuestionQueueList
            pending={pendingQuestions}
            completed={completedQuestions}
            texts={tInterview.queue}
          />

          <SpeakerIndicator activeSpeaker={activeSpeaker} levels={speakerLevels} labels={tInterview.speaker} />

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700">{tInterview.transcript.title}</h2>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTranscriptView('final')}
                  className={`rounded-full px-3 py-1 transition ${transcriptView === 'final' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tInterview.transcript.viewFinal}
                </button>
                <button
                  type="button"
                  onClick={() => setTranscriptView('draft')}
                  className={`rounded-full px-3 py-1 transition ${transcriptView === 'draft' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {hasDrafts ? `${tInterview.transcript.viewDraft} (${draftCount})` : tInterview.transcript.viewDraft}
                </button>
              </div>
            </div>
            {transcriptView === 'final' && hasDrafts ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {formatTemplate(tInterview.transcript.draftNotice, { count: String(draftCount) })}
              </div>
            ) : null}
            {reminderMessage ? (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700">
                {reminderMessage}
              </div>
            ) : null}
            <div
              ref={transcriptContainerRef}
              className="space-y-4 overflow-y-auto pr-1"
              style={{ maxHeight: '24rem' }}
            >
              {transcriptMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-10 text-center text-slate-500">
                  <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                  <p className="text-sm">{tInterview.transcript.empty}</p>
                </div>
              ) : (
                transcriptMessages.map((msg) => {
                  const key = `${msg.id}-${msg.timestamp}-${msg.status ?? 'final'}`;
                  const isAssistant = msg.role === 'assistant';
                  const isDraft = msg.status === 'draft';
                  const reviewStatus = reviewStatusByMessageId.get(msg.id);
                  const pendingReview = reviewStatus === 'pending';
                  const resolvedReview = reviewStatus === 'resolved';
                  const reasonLabels =
                    msg.reviewReasons && msg.reviewReasons.length > 0
                      ? msg.reviewReasons.map(
                          (reason) =>
                            tInterview.transcript.reviewReasons[
                              reason as keyof typeof tInterview.transcript.reviewReasons
                            ] ?? reason
                        )
                      : [];
                  const bubbleClass = isDraft
                    ? 'bg-white text-slate-800 ring-1 ring-slate-200 border border-dashed border-slate-300'
                    : isAssistant
                    ? 'bg-white text-slate-900 ring-1 ring-slate-200/70'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-indigo-200/50';
                  const reasonTextClass = isAssistant || isDraft ? 'text-slate-500' : 'text-white/80';
                  return (
                    <div
                      key={key}
                      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-lg rounded-2xl px-4 py-3 shadow-sm ${bubbleClass}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              isDraft ? 'text-slate-500' : isAssistant ? 'text-slate-500' : 'text-white/90'
                            }`}
                          >
                            {isAssistant ? tInterview.transcript.assistantLabel : tInterview.transcript.userLabel}
                          </p>
                          <div className="flex items-center gap-1">
                            {isDraft ? (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                {tInterview.transcript.draftBadge}
                              </span>
                            ) : null}
                            {pendingReview ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                {tInterview.transcript.reviewBadge}
                              </span>
                            ) : null}
                            {resolvedReview ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                ✅ {tInterview.transcript.resolvedBadge}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p
                          className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                            isDraft ? 'text-slate-700' : ''
                          }`}
                        >
                          {msg.content}
                        </p>
                        {pendingReview && reasonLabels.length > 0 ? (
                          <ul className={`mt-2 space-y-1 text-xs ${reasonTextClass}`}>
                            {reasonLabels.map((label) => (
                              <li key={label}>• {label}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200/60 bg-white/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {tInterview.transcript.reviewTitle}
                </h3>
                {reviewEntries.length > 0 ? (
                  <span className="text-[11px] font-medium text-slate-400">
                    {formatTemplate(tInterview.transcript.reviewCount, { count: String(reviewEntries.length) })}
                  </span>
                ) : null}
              </div>
              {reviewEntries.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">{tInterview.transcript.reviewEmpty}</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {reviewEntries.map((entry) => {
                    const message =
                      messages.find((item) => item.id === entry.messageId) ||
                      draftMessages.find((item) => item.id === entry.messageId);
                    const isResolved = entry.resolved;
                    const badgeClass = isResolved
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700';
                    const containerClass = isResolved
                      ? 'border border-emerald-200 bg-emerald-50/60'
                      : 'border border-amber-200 bg-amber-50/60';
                    return (
                      <li key={entry.id} className={`rounded-xl px-3 py-3 text-slate-700 ${containerClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {message
                                ? message.role === 'assistant'
                                  ? tInterview.transcript.assistantLabel
                                  : tInterview.transcript.userLabel
                                : tInterview.transcript.unknownSpeaker}
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              {message?.content ?? tInterview.transcript.messageMissing}
                            </p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {entry.reasons.map((reason) => (
                                <li key={reason}>
                                  •{' '}
                                  {tInterview.transcript.reviewReasons[
                                    reason as keyof typeof tInterview.transcript.reviewReasons
                                  ] ?? reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                              {isResolved ? tInterview.transcript.resolvedBadge : tInterview.transcript.reviewBadge}
                            </span>
                            {!isResolved ? (
                              <button
                                type="button"
                                onClick={() => resolveReviewEntry(entry.id)}
                                className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
                              >
                                {tInterview.transcript.markResolved}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => clearReviewEntry(entry.messageId, 'manual')}
                                className="text-xs font-semibold text-slate-400 transition hover:text-slate-600"
                              >
                                {tInterview.transcript.dismissResolved}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <audio ref={audioRef} style={{ display: 'none' }} />

          {wrapUpModalOpen ? (
            <WrapUpModal
              texts={tInterview.timer.wrapModal}
              onStop={stopInterview}
              onExtend={extendTimer}
              allowExtend={timerExtensionCount === 0}
              countdownSeconds={autoWrapCountdown}
            />
          ) : null}

          {postSessionInfo && (
            <div className="mt-6 rounded-2xl border border-white/60 bg-white/95 p-6 shadow-lg ring-1 ring-slate-900/10 backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-900">{tInterview.postSession.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{tInterview.postSession.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/dashboard" className="btn-secondary">
                  {tInterview.postSession.dashboard}
                </Link>
                {postSessionInfo.companyId ? (
                  <Link href={`/docs/${postSessionInfo.companyId}`} className="btn-secondary">
                    {tInterview.postSession.docs}
                  </Link>
                ) : null}
                <button onClick={resetInterviewState} className="btn-primary">
                  {tInterview.postSession.restart}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {tInterview.postSession.tip}
              </p>
            </div>
          )}
        </section>

        <aside className="section-surface p-8">
          <h2 className="text-lg font-semibold text-slate-900">{tInterview.coverage.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{tInterview.coverage.subtitle}</p>

          <div className="mt-6 space-y-5">
            {coverageLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
                <div className="h-2 w-2 animate-ping rounded-full bg-indigo-400" />
                <span>{tInterview.coverage.syncing}</span>
              </div>
            ) : coverageProgress.length === 0 ? (
              <p className="text-sm text-slate-500">{tInterview.coverage.empty}</p>
            ) : (
              coverageProgress.slice(0, 6).map((entry) => (
                <TopicProgress
                  key={entry.topicId}
                  name={entry.topicName}
                  coverage={Math.round(entry.coverage)}
                  confidence={Math.round(entry.confidence)}
                  metricLabel={tInterview.coverage.metricLabel}
                  evidence={entry.evidence}
                  nextQuestions={entry.nextQuestions}
                />
              ))
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-700">{tInterview.coverage.suggestedTitle}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {prioritizedTopics.length === 0 ? (
                <li>{tInterview.coverage.suggestedEmpty}</li>
              ) : (
                prioritizedTopics.map((topic) => (
                  <li key={topic.topicId}>
                    • {tInterview.coverage.suggestedItemPrefix}{' '}
                    <span className="font-medium text-slate-700">{topic.topicName}</span>{' '}
                    {formatTemplate(tInterview.coverage.suggestedItemSuffix, {
                      coverage: String(Math.round(topic.coverage)),
                      confidence: String(Math.round(topic.confidence)),
                    })}
                    {topic.nextQuestions && topic.nextQuestions.length > 0 ? (
                      <span className="ml-2 text-xs text-slate-400">{topic.nextQuestions[0]}</span>
                    ) : null}
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

function TopicProgress({
  name,
  coverage,
  confidence,
  metricLabel,
  evidence,
  nextQuestions,
}: {
  name: string;
  coverage: number;
  confidence: number;
  metricLabel: string;
  evidence?: CoverageEvidenceSummary[];
  nextQuestions?: string[];
}) {
  const safeCoverage = Math.max(0, Math.min(100, coverage));
  const safeConfidence = Math.max(0, Math.min(100, confidence));
  const evidenceList = evidence ?? [];
  const questions = nextQuestions ?? [];
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
        {metricLabel}: <span className="font-semibold text-slate-600">{Math.round(safeConfidence)}%</span>
      </div>
      {evidenceList.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">Evidence ({evidenceList.length})</summary>
          <ul className="mt-2 space-y-2">
            {evidenceList.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded bg-slate-100 px-3 py-2 text-slate-600">
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                  {item.evidenceType.replace('_', ' ')} · {Math.round((item.confidence ?? 0) * 100)}%
                </span>
                <p className="mt-1 text-xs text-slate-600">{item.excerpt ?? '—'}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {questions.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">Open questions</summary>
          <ul className="mt-2 space-y-1 list-disc pl-4">
            {questions.slice(0, 5).map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ResumeBanner({
  snapshot,
  texts,
  onResume,
  onDiscard,
}: {
  snapshot: AutosaveSnapshot;
  texts: Dictionary['interview']['timer']['resume'];
  onResume: () => void;
  onDiscard: () => void;
}) {
  const updatedAt = useMemo(() => {
    try {
      return new Date(snapshot.updatedAt);
    } catch (error) {
      return null;
    }
  }, [snapshot.updatedAt]);

  const timerSummary = snapshot.timerOption === 'unlimited'
    ? texts.timer.unlimited
    : formatTemplate(texts.timer.timeboxed, {
        minutes: String(TIMER_OPTIONS.find((option) => option.id === snapshot.timerOption)?.minutes ?? 0),
      });

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">{texts.title}</h3>
          <p className="mt-1 text-sm text-amber-800">
            {formatTemplate(texts.description, {
              updated:
                updatedAt && Number.isFinite(updatedAt.getTime())
                  ? updatedAt.toLocaleString()
                  : texts.fallbackTimestamp,
            })}
          </p>
          <p className="mt-1 text-xs text-amber-700">{timerSummary}</p>
        </div>
        <div className="flex flex-shrink-0 gap-3">
          <button type="button" onClick={onResume} className="btn-primary px-4 py-2 text-sm">
            {texts.continueCta}
          </button>
          <button type="button" onClick={onDiscard} className="btn-secondary px-4 py-2 text-sm">
            {texts.discardCta}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimerSelector({
  option,
  onChange,
  optionTexts,
  disabled,
  unlimitedReminderMinutes,
  onReminderChange,
  showReminderPicker,
  pendingResume,
  reminderTexts,
}: {
  option: TimerOptionId;
  onChange: (option: TimerOptionId) => void;
  optionTexts: Dictionary['interview']['timer']['options'];
  disabled: boolean;
  unlimitedReminderMinutes: number;
  onReminderChange: (minutes: number) => void;
  showReminderPicker: boolean;
  pendingResume: boolean;
  reminderTexts: Dictionary['interview']['timer']['unlimitedReminder'];
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {optionTexts.heading}
        </p>
        {pendingResume ? (
          <span className="text-xs font-medium text-slate-600">{optionTexts.pendingResume}</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {TIMER_OPTIONS.map((opt) => {
          const text = optionTexts[opt.id];
          const selected = option === opt.id;
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                selected
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                  : disabled
                  ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400 opacity-70'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
              }`}
            >
              <input
                type="radio"
                name="session-length"
                value={opt.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(opt.id)}
                className="sr-only"
              />
              <span>{text.label}</span>
              <span className="mt-1 text-[11px] font-normal text-slate-500">{text.description}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{optionTexts.guidance}</p>
      {showReminderPicker ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-500">{reminderTexts.label}</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            value={unlimitedReminderMinutes}
            onChange={(event) => onReminderChange(Number(event.target.value))}
            disabled={disabled}
          >
            {UNLIMITED_REMINDER_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0
                  ? reminderTexts.none
                  : formatTemplate(reminderTexts.every, { minutes: String(minutes) })}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function TimerPill({
  label,
  value,
  tone,
  isActive,
  autoWrapSeconds,
  texts,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'danger';
  isActive: boolean;
  autoWrapSeconds: number | null;
  texts: Dictionary['interview']['timer'];
}) {
  const toneClasses = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-600'
    : tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-slate-200 bg-slate-50 text-slate-600';
  const pulseClass = isActive ? 'shadow-sm' : 'opacity-80';
  return (
    <span className={`inline-flex min-w-[140px] flex-col rounded-2xl border px-4 py-2 text-xs font-semibold ${toneClasses} ${pulseClass}`}>
      <span className="uppercase tracking-wide text-[10px] text-current/70">{label}</span>
      <span className="text-lg font-semibold leading-tight text-current">{value}</span>
      {autoWrapSeconds !== null ? (
        <span className="mt-1 text-[11px] font-medium text-current/80">
          {formatTemplate(texts.autoWrapCountdown, {
            seconds: formatSeconds(autoWrapSeconds),
          })}
        </span>
      ) : null}
    </span>
  );
}

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function WrapUpModal({
  texts,
  onStop,
  onExtend,
  allowExtend,
  countdownSeconds,
}: {
  texts: Dictionary['interview']['timer']['wrapModal'];
  onStop: () => void;
  onExtend: () => void;
  allowExtend: boolean;
  countdownSeconds: number | null;
}) {
  const countdown = countdownSeconds !== null ? formatSeconds(countdownSeconds) : '60';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{texts.title}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {formatTemplate(texts.description, { countdown })}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={onStop}>
            {texts.stop}
          </button>
          <button
            type="button"
            className={`btn-secondary ${!allowExtend ? 'cursor-not-allowed opacity-60' : ''}`}
            onClick={allowExtend ? onExtend : undefined}
            disabled={!allowExtend}
          >
            {allowExtend ? texts.extend : texts.extendDisabled}
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrentQuestionCard({
  question,
  pendingCount,
  onMarkAnswered,
  onSkip,
  onFeedback,
  feedback,
  texts,
}: {
  question: QuestionQueueItem | null;
  pendingCount: number;
  onMarkAnswered: () => void;
  onSkip: () => void;
  onFeedback: (targetId: string, rating: 'up' | 'down') => void;
  feedback: 'up' | 'down' | null;
  texts: Dictionary['interview']['queue'];
}) {
  if (!question) {
    return (
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        {texts.empty}
      </div>
    );
  }

  const pendingLabel = formatTemplate(texts.pendingCount, { count: String(pendingCount) });

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {texts.currentTitle}
          </span>
          <h3 className="text-lg font-semibold text-slate-900">{question.question}</h3>
          <p className="text-sm text-slate-500">
            {question.topicName} · {pendingLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            question.required ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {question.required ? texts.requiredTag : texts.optionalTag}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={onMarkAnswered}>
          {texts.markAnswered}
        </button>
        <button type="button" className="btn-secondary" onClick={onSkip}>
          {texts.skip}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-500">{texts.feedbackPrompt}</span>
        <FeedbackChip
          label={texts.feedbackPositive}
          active={feedback === 'up'}
          onClick={() => onFeedback(question.targetId, 'up')}
        />
        <FeedbackChip
          label={texts.feedbackNegative}
          active={feedback === 'down'}
          onClick={() => onFeedback(question.targetId, 'down')}
        />
      </div>
    </div>
  );
}

function QuestionQueueList({
  pending,
  completed,
  texts,
}: {
  pending: QuestionQueueItem[];
  completed: QuestionQueueItem[];
  texts: Dictionary['interview']['queue'];
}) {
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{texts.nextTitle}</h3>
          <span className="text-xs text-slate-400">{formatTemplate(texts.pendingCount, { count: String(pending.length) })}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {texts.nextDescription}
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {pending.length === 0 ? (
            <li>{texts.nextEmpty}</li>
          ) : (
            pending.slice(0, 5).map((item) => (
              <li key={item.targetId} className="rounded-xl bg-slate-100 px-3 py-2">
                <span className="font-medium text-slate-700">{item.topicName}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                  {item.required ? texts.requiredTag : texts.optionalTag}
                </span>
                <p className="mt-1 text-slate-600">{item.question}</p>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5">
        <h3 className="text-sm font-semibold text-slate-700">{texts.completedTitle}</h3>
        <p className="mt-1 text-xs text-slate-500">{texts.completedDescription}</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-500">
          {completed.length === 0 ? (
            <li>{texts.completedEmpty}</li>
          ) : (
            completed.slice(-5).reverse().map((item) => (
              <li key={`${item.targetId}-${item.status}`} className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                <span className="font-semibold">{item.topicName}</span>
                <p className="mt-1 text-sm">{item.question}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function FeedbackChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function fireAnalyticsEvent(eventName: string, detail: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(`kh-${eventName}`, { detail }));
  } catch (error) {
    console.warn('Failed to dispatch analytics event', eventName, error);
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', eventName, detail);
  }
}

function SpeakerIndicator({
  activeSpeaker,
  levels,
  labels,
}: {
  activeSpeaker: 'assistant' | 'user' | null;
  levels: { user: number; assistant: number };
  labels: Dictionary['interview']['speaker'];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
      <span className="font-semibold text-slate-500">{labels.liveActivity}</span>
      <SpeakerPill label={labels.user} isActive={activeSpeaker === 'user'} accent="user" level={levels.user} speakingLabel={labels.speaking} />
      <SpeakerPill label={labels.assistant} isActive={activeSpeaker === 'assistant'} accent="assistant" level={levels.assistant} speakingLabel={labels.speaking} />
    </div>
  );
}

function SpeakerPill({
  label,
  isActive,
  accent,
  level,
  speakingLabel,
}: {
  label: string;
  isActive: boolean;
  accent: 'assistant' | 'user';
  level: number;
  speakingLabel: string;
}) {
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
      {isActive ? <span className="text-xs uppercase tracking-wide">{speakingLabel}</span> : null}
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

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((acc, [key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}}`, 'g');
    return acc.replace(pattern, value);
  }, template);
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

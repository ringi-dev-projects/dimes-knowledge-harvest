'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from "next/link";
import { TopicTree } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';

type Mode = 'new' | 'extend';

interface FormData {
  companyName: string;
  companyUrl: string;
  focusArea: string;
  description: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

interface Step {
  id: 'companyName' | 'companyUrl' | 'focusArea' | 'description';
  field: keyof FormData;
  prompt: string;
  optional?: boolean;
}

const DEFAULT_FOCUS_SUGGESTIONS = [
  'Onboarding new hires',
  'Manufacturing process',
  'Critical equipment maintenance',
  'Customer support playbook',
  'Safety & compliance routines',
];

export default function SeedPage() {
  const {
    companyId,
    companyName: storedCompanyName,
    setCompanyId,
    setCompanyName: setContextCompanyName,
  } = useCompany();

  const [mode, setMode] = useState<Mode>('new');
  const [formData, setFormData] = useState<FormData>({
    companyName: storedCompanyName || '',
    companyUrl: '',
    focusArea: '',
    description: '',
  });
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topicTree, setTopicTree] = useState<TopicTree | null>(null);
  const [existingTopicTree, setExistingTopicTree] = useState<TopicTree | null>(null);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [initialConversationDone, setInitialConversationDone] = useState(false);

  const createMessage = useCallback(
    (role: 'assistant' | 'user', content: string): ChatMessage => ({
      id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      content,
    }),
    []
  );

  const simplifyTopicTree = useCallback((tree: TopicTree): TopicTree => {
    const trimTargets = (targets: any[] | undefined, limit: number) =>
      Array.isArray(targets) ? targets.slice(0, limit) : [];

    const trimChildren = (children: any[] | undefined) =>
      Array.isArray(children)
        ? children.slice(0, 3).map((child) => ({
            ...child,
            targets: trimTargets(child.targets, 2),
            children: [],
          }))
        : [];

    return {
      ...tree,
      topics: (tree.topics || []).slice(0, 5).map((topic) => ({
        ...topic,
        targets: trimTargets(topic.targets, 3),
        children: trimChildren(topic.children),
      })),
    };
  }, []);

  const buildSteps = useCallback(
    (nextMode: Mode, form: FormData, hasExisting: boolean): Step[] => {
      const steps: Step[] = [];

      if (nextMode === 'new' && !form.companyName) {
        steps.push({
          id: 'companyName',
          field: 'companyName',
          prompt: "First things first—what's the company called?",
        });
      }

      steps.push({
        id: 'companyUrl',
        field: 'companyUrl',
        prompt: 'Do you have a public URL I can skim for extra context? (optional)',
        optional: true,
      });

      steps.push({
        id: 'focusArea',
        field: 'focusArea',
        prompt:
          nextMode === 'extend' && hasExisting
            ? 'Which product, business unit, or knowledge area should we extend next?'
            : 'Which product, business unit, or knowledge area should we focus on first?',
      });

      steps.push({
        id: 'description',
        field: 'description',
        prompt:
          nextMode === 'extend' && hasExisting
            ? 'Share any fresh context or goals for this update so the map stays concise.'
            : 'Share a quick description so I can tailor the map to the way your company operates.',
      });

      return steps;
    },
    []
  );

  const buildInitialMessages = useCallback(
    (nextMode: Mode, form: FormData, nextSteps: Step[], hasExisting: boolean) => {
      const intro = nextMode === 'extend' && hasExisting
        ? `We already have a knowledge map for ${form.companyName || 'this company'}. Let's capture a fresh slice so I can extend it without duplicating what we know.`
        : "Let's gather a few essentials so I can draft a concise topic map you can interview against.";

      const initial: ChatMessage[] = [createMessage('assistant', intro)];

      if (nextSteps[0]) {
        initial.push(createMessage('assistant', nextSteps[0].prompt));
      }

      return initial;
    },
    [createMessage]
  );

  const resetConversation = useCallback(
    (nextMode: Mode, initialForm: FormData, hasExisting: boolean) => {
      setMode(nextMode);
      setFormData(initialForm);
      const nextSteps = buildSteps(nextMode, initialForm, hasExisting);
      setSteps(nextSteps);
      setMessages(buildInitialMessages(nextMode, initialForm, nextSteps, hasExisting));
      setCurrentStepIndex(nextSteps.length > 0 ? 0 : nextSteps.length);
      setInputValue('');
    },
    [buildInitialMessages, buildSteps]
  );

  const fetchLatestTopicTree = useCallback(
    async (targetCompanyId: number) => {
      try {
        const response = await fetch(`/api/topic-tree/latest?companyId=${targetCompanyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.topicTree) {
            const simplified = simplifyTopicTree(data.topicTree);
            setExistingTopicTree(simplified);
            setTopicTree(simplified);
            return simplified;
          }
          setExistingTopicTree(null);
        }
      } catch (err) {
        console.error('Failed to load topic tree:', err);
      }
      return null;
    },
    [simplifyTopicTree]
  );

  useEffect(() => {
    const load = async () => {
      if (companyId) {
        await fetchLatestTopicTree(companyId);
      } else {
        setExistingTopicTree(null);
      }
      setExistingLoaded(true);
    };
    load();
  }, [companyId, fetchLatestTopicTree]);

  useEffect(() => {
    if (!existingLoaded || initialConversationDone) return;
    const hasExisting = Boolean(existingTopicTree);
    const defaultMode: Mode = hasExisting ? 'extend' : 'new';
    const defaultForm: FormData = {
      companyName: hasExisting
        ? existingTopicTree?.company ?? storedCompanyName ?? ''
        : storedCompanyName ?? '',
      companyUrl: '',
      focusArea: '',
      description: '',
    };
    resetConversation(defaultMode, defaultForm, hasExisting);
    setInitialConversationDone(true);
  }, [
    existingLoaded,
    existingTopicTree,
    initialConversationDone,
    resetConversation,
    storedCompanyName,
  ]);

  const focusSuggestions = useMemo(() => {
    if (existingTopicTree) {
      return existingTopicTree.topics.map((topic) => topic.name).slice(0, 6);
    }
    return DEFAULT_FOCUS_SUGGESTIONS;
  }, [existingTopicTree]);

  const currentStep = steps[currentStepIndex];
  const inputDisabled = loading || !currentStep;

  const appendMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMessages]);
  }, []);

  const updateFormField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleGenerate = useCallback(
    async (completedForm: FormData) => {
      const assistantCue = createMessage('assistant', 'Great. Give me a moment to map this out…');
      appendMessages([assistantCue]);
      setLoading(true);
      setError('');

      try {
        const body: Record<string, unknown> = {
          url: completedForm.companyUrl || undefined,
          companyName:
            completedForm.companyName || existingTopicTree?.company || storedCompanyName || '',
          description: completedForm.description,
          focusArea: completedForm.focusArea,
          mode,
        };

        if (mode === 'extend' && existingTopicTree && companyId) {
          body.companyId = companyId;
          body.existingTopicTree = existingTopicTree;
        }

        const response = await fetch('/api/seed-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to generate topic tree' }));
          throw new Error(errorData.error || 'Failed to generate topic tree');
        }

        const data = await response.json();
        const simplified = simplifyTopicTree(data.topicTree);
        setTopicTree(simplified);
        setExistingTopicTree(simplified);
        appendMessages([
          createMessage(
            'assistant',
            'All set! Scroll down to review the refreshed map or jump straight into the interview.'
          ),
        ]);

        if (data.companyId) {
          setCompanyId(data.companyId);
          await fetchLatestTopicTree(data.companyId);
        }

        const resolvedCompanyName = data.topicTree?.company || completedForm.companyName;
        if (resolvedCompanyName) {
          setContextCompanyName(resolvedCompanyName);
        }

        const nextForm: FormData = {
          companyName: resolvedCompanyName || '',
          companyUrl: '',
          focusArea: '',
          description: '',
        };
        setFormData(nextForm);
        setMode('extend');
      } catch (err) {
        console.error('Seed error:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate topic tree');
        appendMessages([
          createMessage(
            'assistant',
            'I hit a snag capturing the topics. Fix the issue above and we can try again.'
          ),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessages,
      companyId,
      createMessage,
      existingTopicTree,
      fetchLatestTopicTree,
      mode,
      setCompanyId,
      setContextCompanyName,
      simplifyTopicTree,
      storedCompanyName,
    ]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!currentStep || loading) {
        return;
      }

      const trimmedValue = inputValue.trim();
      if (!trimmedValue && !currentStep.optional) {
        setError('Please provide a quick answer so I can keep going.');
        return;
      }
      setError('');

      const userMessage = createMessage(
        'user',
        trimmedValue.length > 0 ? trimmedValue : currentStep.optional ? '[Skipped]' : ''
      );
      appendMessages([userMessage]);
      const updatedForm = {
        ...formData,
        [currentStep.field]: trimmedValue,
      };
      updateFormField(currentStep.field, trimmedValue);
      setInputValue('');

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        const nextStep = steps[nextIndex];
        appendMessages([createMessage('assistant', nextStep.prompt)]);
        setCurrentStepIndex(nextIndex);
      } else {
        setCurrentStepIndex(steps.length);
        await handleGenerate(updatedForm);
      }
    },
    [
      appendMessages,
      createMessage,
      currentStep,
      currentStepIndex,
      formData,
      handleGenerate,
      inputValue,
      loading,
      steps,
      updateFormField,
    ]
  );

  const startExtendFlow = useCallback(() => {
    if (!existingTopicTree) return;
    const form: FormData = {
      companyName: existingTopicTree.company,
      companyUrl: '',
      focusArea: '',
      description: '',
    };
    resetConversation('extend', form, true);
    setMode('extend');
  }, [existingTopicTree, resetConversation]);

  const startNewCompanyFlow = useCallback(() => {
    const form: FormData = {
      companyName: '',
      companyUrl: '',
      focusArea: '',
      description: '',
    };
    resetConversation('new', form, false);
    setMode('new');
  }, [resetConversation]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
  }, []);

  return (
    <div className="page-shell space-y-6">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white p-5 shadow-md ring-1 ring-slate-900/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Seed topics</h1>
              <p className="mt-1 text-sm text-slate-600">
                Start with a focused map and refine as you capture more knowledge.
              </p>
            </div>
            {existingTopicTree ? (
              <Link href="/dashboard" className="hidden text-xs font-semibold text-indigo-600 sm:block">
                View dashboard →
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {existingTopicTree ? (
                <CurrentMapCard
                  topicTree={existingTopicTree}
                  onExtend={startExtendFlow}
                  onSeedNew={startNewCompanyFlow}
                />
              ) : (
                <FirstTimeCard />
              )}
            </div>
            <TipsCard />
          </div>
        </section>

        <section className="relative flex flex-col rounded-3xl border border-white/60 bg-white p-0 shadow-xl ring-1 ring-slate-900/10">
          <div className="flex min-h-[460px] flex-1 flex-col rounded-3xl bg-gradient-to-br from-slate-950/92 via-slate-900/88 to-slate-800/85 p-6 text-slate-100">
            <div className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
              Intake assistant
            </div>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2 text-sm">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {loading ? (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-indigo-300" />
                  Mapping topics…
                </div>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {error ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-800">
                  {error}
                </div>
              ) : null}
              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <div className="relative flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={inputDisabled}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!inputDisabled) {
                          (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
                        }
                      }
                    }}
                    placeholder={
                      currentStep
                        ? 'Type your answer and press enter…'
                        : 'All set! Use the actions above to seed another area.'
                    }
                    className={cn(
                      'w-full resize-none rounded-xl border border-slate-600/50 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/40 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500'
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={inputDisabled}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition',
                    inputDisabled
                      ? 'bg-slate-700 text-slate-500'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  )}
                >
                  Send
                </button>
              </form>
              {currentStep?.id === 'focusArea' ? (
                <div className="flex flex-wrap gap-2">
                  {focusSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-indigo-300 hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              {!currentStep && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                  Want to add another area or start fresh? Use the actions on the left to relaunch the intake.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {topicTree ? (
        <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="badge-soft">Generated map</span>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Topic tree preview</h2>
              <p className="text-sm text-slate-500">Company: {topicTree.company}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/interview" className="btn-primary">
                Start interview
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                View dashboard
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topicTree.topics.map((topic) => (
              <TopicPreview key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md shadow-black/20',
          isAssistant ? 'bg-slate-800/80 text-slate-100' : 'bg-indigo-500 text-white'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function CurrentMapCard({
  topicTree,
  onExtend,
  onSeedNew,
}: {
  topicTree: TopicTree;
  onExtend: () => void;
  onSeedNew: () => void;
}) {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Current map</p>
          <p>{topicTree.company}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={onExtend}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
          >
            Extend
          </button>
          <button
            type="button"
            onClick={onSeedNew}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
          >
            New company
          </button>
        </div>
      </div>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs text-slate-500">
        {topicTree.topics.slice(0, 6).map((topic) => (
          <div key={topic.id} className="rounded-xl bg-white px-3 py-2 shadow-sm">
            <p className="font-semibold text-slate-900">{topic.name}</p>
            <p>
              {(topic.targets || [])
                .slice(0, 2)
                .map((target: any) => target.q)
                .join(' • ') || 'Prompts ready to go'}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Extend one area at a time—you can always loop back to add another division.
      </div>
    </div>
  );
}

function FirstTimeCard() {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div>
        <p className="font-semibold text-slate-900">New company?</p>
        <p>Share the basics—name, optional URL, and the first area you want to document. We’ll return a compact, interview-ready topic list.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <p className="font-semibold text-slate-600">Example inputs</p>
        <ul className="mt-2 space-y-1">
          <li>• Company name: “Acme Precision Parts”</li>
          <li>• Focus area: “CNC machining QA checks”</li>
          <li>• Description: 2–3 sentences on teams, processes, or pain points</li>
        </ul>
      </div>
    </div>
  );
}

function TipsCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
      <p className="font-semibold text-slate-600">Tips</p>
      <ul className="mt-2 space-y-1">
        <li>• Be specific (“Assembly line onboarding” beats “operations”).</li>
        <li>• Re-run the intake anytime to add a new division or product line.</li>
      </ul>
    </div>
  );
}

function TopicPreview({ topic }: { topic: any }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm ring-1 ring-slate-900/10 backdrop-blur">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{topic.name}</h3>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Weight {topic.weight ?? 3}
        </p>
      </div>
      <div className="space-y-2 text-sm text-slate-600">
        {(topic.targets || []).slice(0, 3).map((target: any) => (
          <div key={target.id} className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
            <p>
              {target.required ? <span className="mr-1 inline text-rose-500">*</span> : null}
              {target.q}
            </p>
          </div>
        ))}
        {(topic.children || []).slice(0, 2).map((child: any) => (
          <div
            key={child.id}
            className="rounded-xl border border-indigo-100/70 bg-indigo-50/70 px-3 py-2 text-sm text-indigo-700"
          >
            <p className="font-semibold">{child.name}</p>
            <p className="mt-1 text-xs text-indigo-500">
              {(child.targets || []).slice(0, 2).map((target: any) => target.q).join(' • ') ||
                'Follow-up prompts ready'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

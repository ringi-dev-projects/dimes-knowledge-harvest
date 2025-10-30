'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from "next/link";
import { TopicTree } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';
import { useLocale } from '@/lib/context/LocaleContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';

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

export default function SeedPage() {
  const {
    companyId,
    companyName: storedCompanyName,
    setCompanyId,
    setCompanyName: setContextCompanyName,
  } = useCompany();
  const { dictionary, locale } = useLocale();
  const seedCopy = dictionary.seed;
  const assistantCopy = seedCopy.assistant;

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
      const prompts = assistantCopy.prompts;

      if (nextMode === 'new' && !form.companyName) {
        steps.push({
          id: 'companyName',
          field: 'companyName',
          prompt: prompts.companyName,
        });
      }

      steps.push({
        id: 'companyUrl',
        field: 'companyUrl',
        prompt: prompts.companyUrl,
        optional: true,
      });

      steps.push({
        id: 'focusArea',
        field: 'focusArea',
        prompt: nextMode === 'extend' && hasExisting ? prompts.focusExtend : prompts.focusNew,
      });

      steps.push({
        id: 'description',
        field: 'description',
        prompt: nextMode === 'extend' && hasExisting ? prompts.descriptionExtend : prompts.descriptionNew,
      });

      return steps;
    },
    [assistantCopy]
  );

  const buildInitialMessages = useCallback(
    (nextMode: Mode, form: FormData, nextSteps: Step[], hasExisting: boolean) => {
      const companyName = form.companyName || assistantCopy.intros.extendFallback;
      const intro =
        nextMode === 'extend' && hasExisting
          ? formatTemplate(assistantCopy.intros.extend, { company: companyName })
          : assistantCopy.intros.new;

      const initial: ChatMessage[] = [createMessage('assistant', intro)];

      if (nextSteps[0]) {
        initial.push(createMessage('assistant', nextSteps[0].prompt));
      }

      return initial;
    },
    [assistantCopy, createMessage]
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
    return seedCopy.focusSuggestions;
  }, [existingTopicTree, seedCopy]);

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
      const assistantCue = createMessage('assistant', assistantCopy.mappingCue);
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
          locale,
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
          const errorData = await response.json().catch(() => ({ error: assistantCopy.failure }));
          throw new Error(errorData.error || assistantCopy.failure);
        }

        const data = await response.json();
        const simplified = simplifyTopicTree(data.topicTree);
        setTopicTree(simplified);
        setExistingTopicTree(simplified);
        appendMessages([
          createMessage('assistant', assistantCopy.success),
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
        setError(err instanceof Error ? err.message : assistantCopy.failure);
        appendMessages([createMessage('assistant', assistantCopy.failure)]);
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessages,
      assistantCopy,
      companyId,
      createMessage,
      existingTopicTree,
      fetchLatestTopicTree,
      mode,
      locale,
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
        setError(assistantCopy.errorRequired);
        return;
      }
      setError('');

      const userMessage = createMessage(
        'user',
        trimmedValue.length > 0 ? trimmedValue : currentStep.optional ? assistantCopy.skipTag : ''
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
      assistantCopy,
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
              <h1 className="text-2xl font-semibold text-slate-900">{seedCopy.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{seedCopy.subtitle}</p>
            </div>
            {existingTopicTree ? (
              <Link href="/dashboard" className="hidden text-xs font-semibold text-indigo-600 sm:block">
                {seedCopy.dashboardLink}
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
                  panels={seedCopy.panels}
                />
              ) : (
                <FirstTimeCard panels={seedCopy.panels} />
              )}
            </div>
            <TipsCard panels={seedCopy.panels} />
          </div>
        </section>

        <section className="relative flex flex-col rounded-3xl border border-white/60 bg-white p-0 shadow-xl ring-1 ring-slate-900/10">
          <div className="flex min-h-[460px] flex-1 flex-col rounded-3xl bg-gradient-to-br from-slate-950/92 via-slate-900/88 to-slate-800/85 p-6 text-slate-100">
            <div className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
              {seedCopy.assistantLabel}
            </div>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2 text-sm">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {loading ? (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-indigo-300" />
                  {assistantCopy.mappingIndicator}
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
                        ? assistantCopy.placeholderActive
                        : assistantCopy.placeholderComplete
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
                  {assistantCopy.send}
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
                  {assistantCopy.completeHint}
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
              <span className="badge-soft">{seedCopy.results.badge}</span>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">{seedCopy.results.title}</h2>
              <p className="text-sm text-slate-500">
                {seedCopy.results.companyLabel}: {topicTree.company}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/interview" className="btn-primary">
                {seedCopy.results.startInterview}
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                {seedCopy.results.viewDashboard}
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topicTree.topics.map((topic) => (
              <TopicPreview key={topic.id} topic={topic} labels={seedCopy.topicPreview} />
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
  panels,
}: {
  topicTree: TopicTree;
  onExtend: () => void;
  onSeedNew: () => void;
  panels: Dictionary['seed']['panels'];
}) {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{panels.currentTitle}</p>
          <p>{topicTree.company}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={onExtend}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
          >
            {panels.extend}
          </button>
          <button
            type="button"
            onClick={onSeedNew}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
          >
            {panels.newCompany}
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
                .join(' • ') || panels.promptsReady}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        {panels.reminder}
      </div>
    </div>
  );
}

function FirstTimeCard({ panels }: { panels: Dictionary['seed']['panels'] }) {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div>
        <p className="font-semibold text-slate-900">{panels.firstTimeTitle}</p>
        <p>{panels.firstTimeDescription}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <p className="font-semibold text-slate-600">{panels.examplesTitle}</p>
        <ul className="mt-2 space-y-1">
          {panels.examples.map((example) => (
            <li key={example}>• {example}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TipsCard({ panels }: { panels: Dictionary['seed']['panels'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
      <p className="font-semibold text-slate-600">{panels.tipsTitle}</p>
      <ul className="mt-2 space-y-1">
        {panels.tips.map((tip) => (
          <li key={tip}>• {tip}</li>
        ))}
      </ul>
    </div>
  );
}

function TopicPreview({ topic, labels }: { topic: any; labels: Dictionary['seed']['topicPreview'] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm ring-1 ring-slate-900/10 backdrop-blur">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{topic.name}</h3>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {labels.weightLabel} {topic.weight ?? 3}
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
                labels.followUps}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const formatTemplate = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce((acc, [key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    return acc.replace(pattern, value);
  }, template);
};

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

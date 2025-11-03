'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from "next/link";
import { CoverageMetrics } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';
import { useLocale } from '@/lib/context/LocaleContext';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

type InterviewSummary = {
  id: number;
  companyId: number;
  speakerName: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  durationSeconds: number | null;
  messageCount: number;
  knowledgeAtomCount: number;
  audioUrl: string | null;
};

const MOCK_INTERVIEWS: InterviewSummary[] = [
  {
    id: 101,
    companyId: 0,
    speakerName: 'Alex Johnson',
    startedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'completed',
    durationSeconds: 1500,
    messageCount: 24,
    knowledgeAtomCount: 6,
    audioUrl: null,
  },
  {
    id: 102,
    companyId: 0,
    speakerName: 'Jordan Smith',
    startedAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: 'completed',
    durationSeconds: 2400,
    messageCount: 31,
    knowledgeAtomCount: 9,
    audioUrl: null,
  },
  {
    id: 103,
    companyId: 0,
    speakerName: 'Taylor Lee',
    startedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    status: 'completed',
    durationSeconds: 1800,
    messageCount: 27,
    knowledgeAtomCount: 7,
    audioUrl: null,
  },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<CoverageMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { companyId, companyName, setCompanyId, setCompanyName } = useCompany();
  const { dictionary, locale } = useLocale();
  const tDash = dictionary.dashboard;
  const tCommon = dictionary.common;
  const metricsText = tDash.metrics;
  const coverageText = tDash.coverageSection;
  const interviewsText = tDash.interviewsSection;
  const cardText = tDash.cards;
  const adminText = tDash.admin;

  const loadData = useCallback(async () => {
    if (!companyId && !useMockData) {
      setMetrics([]);
      setInterviews([]);
      setLoading(false);
      setInterviewsLoading(false);
      return;
    }

    setLoading(true);
    setInterviewsLoading(true);

    try {
      if (useMockData) {
        const response = await fetch('/api/coverage?mock=true');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics || []);
        } else {
          setMetrics([]);
        }
        setInterviews(MOCK_INTERVIEWS);
      } else if (companyId) {
        const [coverageRes, interviewsRes] = await Promise.all([
          fetch(`/api/coverage?companyId=${companyId}`),
          fetch(`/api/interview/list?companyId=${companyId}`),
        ]);

        if (coverageRes.ok) {
          const data = await coverageRes.json();
          setMetrics(data.metrics || []);
        } else {
          setMetrics([]);
        }

        if (interviewsRes.ok) {
          const data = await interviewsRes.json();
          setInterviews(data.interviews || []);
        } else {
          setInterviews([]);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (useMockData) {
        setMetrics([]);
        setInterviews(MOCK_INTERVIEWS);
      } else {
        setMetrics([]);
        setInterviews([]);
      }
    } finally {
      setLoading(false);
      setInterviewsLoading(false);
    }
  }, [companyId, useMockData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const overallCoverage = metrics.length > 0
    ? Math.round(metrics.reduce((acc, m) => acc + m.coveragePercent, 0) / metrics.length)
    : 0;

  const overallConfidence = metrics.length > 0
    ? Math.round(metrics.reduce((acc, m) => acc + m.confidence, 0) / metrics.length)
    : 0;

  const interviewCount = useMockData ? MOCK_INTERVIEWS.length : interviews.length;
  const docsLink = useMockData
    ? '/docs/1?mock=true'
    : companyId
    ? `/docs/${companyId}`
    : '/seed';
  const docsLabel = !companyId && !useMockData ? tDash.hero.docsDisabled : tDash.hero.docsEnabled;
  const docsButtonClass = !companyId && !useMockData ? 'btn-secondary' : 'btn-primary';
  const recentInterviews = useMockData ? MOCK_INTERVIEWS : interviews;

  const handleReset = useCallback(async () => {
    if (!window.confirm(adminText.confirm)) {
      return;
    }

    setResetFeedback(null);
    setResetting(true);

    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      if (!response.ok) {
        let errorMessage = adminText.error;
        try {
          const payload = await response.json();
          if (payload?.error) {
            errorMessage = payload.error;
          }
        } catch (error) {
          // ignore parse errors and use default message
        }
        throw new Error(errorMessage);
      }

      setCompanyId(null);
      setCompanyName(null);
      setMetrics([]);
      setInterviews([]);
      setUseMockData(false);
      setResetFeedback({ type: 'success', message: adminText.success });
    } catch (error) {
      console.error('Reset data error:', error);
      setResetFeedback({ type: 'error', message: adminText.error });
    } finally {
      setResetting(false);
    }
  }, [adminText, setCompanyId, setCompanyName]);

  return (
    <div className="page-shell space-y-10">
      <section className="section-surface p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="badge-soft">{tDash.hero.badge}</span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              {tDash.hero.title}
            </h1>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">
              {companyName ? `${companyName} - ` : ''}
              {tDash.hero.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setUseMockData(!useMockData)}
              className={`btn-secondary ${useMockData ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : ''}`}
            >
              {useMockData ? tDash.hero.toggleMockOn : tDash.hero.toggleMockOff}
            </button>
            <Link href={docsLink} className={docsButtonClass}>
              {docsLabel}
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-500/90 to-purple-500 p-6 text-white shadow-lg shadow-indigo-500/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{metricsText.coverage.title}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{overallCoverage}%</span>
              <span className="text-sm text-white/70">{metricsText.coverage.subtitle}</span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-white/30">
              <div
                className="h-2 rounded-full bg-white"
                style={{ width: `${overallCoverage}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 p-6 text-white shadow-lg shadow-emerald-500/25">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{metricsText.confidence.title}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{overallConfidence}%</span>
              <span className="text-sm text-white/70">{metricsText.confidence.subtitle}</span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-white/30">
              <div
                className="h-2 rounded-full bg-white"
                style={{ width: `${overallConfidence}%` }}
              />
            </div>
          </div>

          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{metricsText.topics.title}</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {metrics.filter((m) => m.coveragePercent > 50).length}
              </span>
              <span className="text-sm text-slate-500">
                {formatTemplate(metricsText.topics.suffix, { total: metrics.length })}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600">{metricsText.topics.summary}</p>
          </div>

          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{metricsText.interviewSessions.title}</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {interviewCount}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {interviewCount === 0
                ? metricsText.interviewSessions.empty
                : metricsText.interviewSessions.nonEmpty}
            </p>
          </div>
        </div>
      </section>

      <section className="section-surface">
        <div className="flex items-center justify-between gap-3 border-b border-white/80 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{coverageText.title}</h2>
            <p className="text-sm text-slate-500">{coverageText.subtitle}</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
            <p className="mt-4 text-sm">{coverageText.loading}</p>
          </div>
        ) : metrics.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="mt-2 text-slate-600">{coverageText.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{coverageText.emptySubtitle}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/seed" className="btn-primary">
                {coverageText.seedCta}
              </Link>
              <button
                onClick={() => setUseMockData(true)}
                className="btn-secondary"
              >
                {coverageText.mockCta}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70">
            {metrics.map((metric) => (
              <TopicCoverageRow key={metric.topicId} metric={metric} coverageCopy={cardText.coverage} />
            ))}
          </div>
        )}
      </section>

      <section className="section-surface p-8">
        <div className="flex flex-col gap-4 border-b border-white/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{interviewsText.title}</h2>
            <p className="text-sm text-slate-500">{interviewsText.subtitle}</p>
          </div>
          <Link href="/interview" className="btn-secondary">
            {interviewsText.startCta}
          </Link>
        </div>

        {interviewsLoading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
            <p className="mt-4 text-sm">{interviewsText.loading}</p>
          </div>
        ) : recentInterviews.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            <p className="mt-2 text-slate-600">{interviewsText.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{interviewsText.emptySubtitle}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/interview" className="btn-primary">
                {interviewsText.primaryCta}
              </Link>
              <Link href="/seed" className="btn-secondary">
                {interviewsText.secondaryCta}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentInterviews.slice(0, 6).map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                mock={useMockData}
                locale={locale}
                cardText={cardText}
                audioLabel={interviewsText.audioBadge}
                docLinkLabel={interviewsText.docLink}
                durationCopy={tCommon.duration}
                timeCopy={tCommon.time}
                statusCopy={tCommon.statuses}
              />
            ))}
          </div>
        )}
      </section>

      <section className="section-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{adminText.title}</h2>
            <p className="text-sm text-slate-500">{adminText.description}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className={`btn-danger ${resetting ? 'opacity-80' : ''}`}
          >
            {resetting ? adminText.buttonBusy : adminText.button}
          </button>
        </div>
        {resetFeedback ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              resetFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-600'
            }`}
          >
            {resetFeedback.message}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    return acc.replace(pattern, String(value));
  }, template);
}

function InterviewCard({
  interview,
  mock,
  locale,
  cardText,
  audioLabel,
  docLinkLabel,
  durationCopy,
  timeCopy,
  statusCopy,
}: {
  interview: InterviewSummary;
  mock: boolean;
  locale: Locale;
  cardText: Dictionary['dashboard']['cards'];
  audioLabel: string;
  docLinkLabel: string;
  durationCopy: Dictionary['common']['duration'];
  timeCopy: Dictionary['common']['time'];
  statusCopy: Dictionary['common']['statuses'];
}) {
  const started = new Date(interview.startedAt);
  const durationText = formatDuration(interview.durationSeconds, durationCopy);
  const relativeTime = formatRelativeTime(started, locale, timeCopy);
  const { badgeLabel, badgeClass } = getStatusStyles(interview.status, statusCopy);

  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm ring-1 ring-slate-900/10 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {interview.speakerName || cardText.defaultSpeaker}
          </p>
          <p className="text-xs text-slate-500">{relativeTime}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{cardText.metrics.duration}</dt>
          <dd className="mt-1 font-medium text-slate-900">{durationText}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{cardText.metrics.knowledge}</dt>
          <dd className="mt-1 font-medium text-slate-900">{interview.knowledgeAtomCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{cardText.metrics.messages}</dt>
          <dd className="mt-1 font-medium text-slate-900">{interview.messageCount}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {audioLabel}
        </span>
        <Link
          href={mock ? '/docs/1?mock=true' : `/docs/${interview.companyId}`}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
        >
          {docLinkLabel}
        </Link>
      </div>
    </div>
  );
}

function getStatusStyles(status: string, statusCopy: Dictionary['common']['statuses']) {
  switch (status) {
    case 'completed':
      return {
        badgeLabel: statusCopy.completed,
        badgeClass: 'bg-emerald-100 text-emerald-700',
      };
    case 'active':
      return {
        badgeLabel: statusCopy.active,
        badgeClass: 'bg-indigo-100 text-indigo-600',
      };
    case 'failed':
      return {
        badgeLabel: statusCopy.failed,
        badgeClass: 'bg-rose-100 text-rose-600',
      };
    default:
      return {
        badgeLabel: formatTemplate(statusCopy.default, { status }),
        badgeClass: 'bg-slate-100 text-slate-600',
      };
  }
}

function formatDuration(seconds: number | null, durationCopy: Dictionary['common']['duration']): string {
  if (!seconds || seconds <= 0) {
    return durationCopy.placeholder;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes > 0) {
    return remainder > 0
      ? formatTemplate(durationCopy.formatFull, { minutes, seconds: remainder })
      : formatTemplate(durationCopy.formatMinutes, { minutes });
  }
  return formatTemplate(durationCopy.formatSeconds, { seconds: remainder });
}

function formatRelativeTime(date: Date, locale: Locale, timeCopy: Dictionary['common']['time']): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return timeCopy.momentsAgo;
  }

  const formatter = new Intl.RelativeTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { numeric: 'auto' });

  if (diffMinutes < 60) {
    return formatter.format(-diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return formatter.format(-diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  return formatter.format(-diffDays, 'day');
}

function TopicCoverageRow({ metric, coverageCopy }: { metric: CoverageMetrics; coverageCopy: Dictionary['dashboard']['cards']['coverage'] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="flex cursor-pointer flex-col gap-5 px-6 py-5 transition hover:bg-indigo-50/40 sm:flex-row sm:items-center sm:justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 space-y-1">
          <h3 className="text-base font-semibold text-slate-900">{metric.topicName}</h3>
          <p className="text-sm text-slate-500">
            {formatTemplate(coverageCopy.answeredTemplate, {
              answered: metric.answeredQuestions,
              total: metric.targetQuestions,
            })}
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">{coverageCopy.coverageLabel}</span>
            <span className="font-semibold text-slate-900">{metric.coveragePercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${metric.coveragePercent}%` }}
            />
          </div>
        </div>

        <div className="w-full max-w-xs sm:max-w-[180px]">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-500">{coverageCopy.confidenceLabel}</span>
            <span className="font-semibold text-slate-900">{metric.confidence}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${metric.confidence}%` }}
            />
          </div>
        </div>

        <button
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 sm:ml-0"
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-200/80 bg-slate-50/60 px-6 py-5">
          {metric.nextQuestions && metric.nextQuestions.length > 0 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-700">{coverageCopy.nextQuestions}</h4>
              <ul className="space-y-1">
                {metric.nextQuestions.slice(0, 5).map((question, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    • {question}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {metric.evidenceSummary && metric.evidenceSummary.length > 0 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-700">{coverageCopy.evidenceLabel}</h4>
              <ul className="space-y-2">
                {metric.evidenceSummary.slice(0, 5).map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-600">
                    <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
                      {item.evidenceType.replace('_', ' ')} · {Math.round((item.confidence ?? 0) * 100)}%
                    </span>
                    <p className="text-slate-700">{item.excerpt ?? '—'}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

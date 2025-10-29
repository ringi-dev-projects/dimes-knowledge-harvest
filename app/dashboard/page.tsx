'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { CoverageMetrics } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<CoverageMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  const { companyId, companyName } = useCompany();

  useEffect(() => {
    loadMetrics();
  }, [useMockData, companyId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const url = companyId && !useMockData
        ? `/api/coverage?companyId=${companyId}`
        : `/api/coverage?mock=true`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallCoverage = metrics.length > 0
    ? Math.round(metrics.reduce((acc, m) => acc + m.coveragePercent, 0) / metrics.length)
    : 0;

  const overallConfidence = metrics.length > 0
    ? Math.round(metrics.reduce((acc, m) => acc + m.confidence, 0) / metrics.length)
    : 0;

  return (
    <div className="page-shell space-y-10">
      <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="badge-soft">Coverage intelligence</span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Knowledge Coverage Dashboard
            </h1>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">
              {companyName ? `${companyName} - ` : ''}Track capture progress by topic, understand confidence levels, and focus interviews where they matter most.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setUseMockData(!useMockData)}
              className={`btn-secondary ${useMockData ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : ''}`}
            >
              {useMockData ? 'Show Real Data' : 'Show Mock Data'}
            </button>
            <Link href="/docs/1" className="btn-primary">
              Generate Documentation
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-500/90 to-purple-500 p-6 text-white shadow-lg shadow-indigo-500/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Overall Coverage</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{overallCoverage}%</span>
              <span className="text-sm text-white/70">of targeted knowledge captured</span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-white/30">
              <div
                className="h-2 rounded-full bg-white"
                style={{ width: `${overallCoverage}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 p-6 text-white shadow-lg shadow-emerald-500/25">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Confidence Score</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{overallConfidence}%</span>
              <span className="text-sm text-white/70">validated across interviews</span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-white/30">
              <div
                className="h-2 rounded-full bg-white"
                style={{ width: `${overallConfidence}%` }}
              />
            </div>
          </div>

          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Topics Covered</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {metrics.filter((m) => m.coveragePercent > 50).length}
              </span>
              <span className="text-sm text-slate-500">of {metrics.length}</span>
            </div>
            <p className="mt-4 text-sm text-slate-600">High-confidence topics that surpass the 50% coverage threshold.</p>
          </div>

          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Interview Sessions</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {useMockData ? 3 : 0}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Sync this dashboard with live interviews to watch coverage fill in.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/95 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/80 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Topic Coverage Details</h2>
            <p className="text-sm text-slate-500">Dive into each topic to uncover gaps, confidence trends, and next-step prompts.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
            <p className="mt-4 text-sm">Fetching the latest coverage metrics…</p>
          </div>
        ) : metrics.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="mt-2 text-slate-600">No coverage data yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Seed topics and launch interviews to see progress here.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/seed" className="btn-primary">
                Seed Topics
              </Link>
              <button
                onClick={() => setUseMockData(true)}
                className="btn-secondary"
              >
                Load Mock Data
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70">
            {metrics.map((metric) => (
              <TopicCoverageRow key={metric.topicId} metric={metric} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TopicCoverageRow({ metric }: { metric: CoverageMetrics }) {
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
            {metric.answeredQuestions} of {metric.targetQuestions} questions answered
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Coverage</span>
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
            <span className="text-slate-500">Confidence</span>
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

      {expanded && metric.nextQuestions && metric.nextQuestions.length > 0 && (
        <div className="border-t border-slate-200/80 bg-slate-50/60 px-6 py-5">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Next Questions to Ask</h4>
          <ul className="space-y-1">
            {metric.nextQuestions.slice(0, 5).map((question, idx) => (
              <li key={idx} className="text-sm text-slate-600">
                • {question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

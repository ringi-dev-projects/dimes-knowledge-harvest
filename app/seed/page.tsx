'use client';

import { useState } from 'react';
import Link from "next/link";
import { TopicTree } from '@/lib/types';
import { useCompany } from '@/lib/context/CompanyContext';

export default function SeedPage() {
  const [url, setUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [topicTree, setTopicTree] = useState<TopicTree | null>(null);
  const [error, setError] = useState('');
  const { setCompanyId, setCompanyName: setContextCompanyName } = useCompany();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTopicTree(null);

    try {
      const response = await fetch('/api/seed-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          companyName,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate topic tree');
      }

      const data = await response.json();
      setTopicTree(data.topicTree);

      // Set company context for use in other pages
      if (data.companyId) {
        setCompanyId(data.companyId);
        setContextCompanyName(companyName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell space-y-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
          <span className="badge-soft">Topic intelligence</span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Seed your topic tree in minutes
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Share a few inputs about your organization and we&apos;ll generate a weighted, interview-ready knowledge map. Jump straight into guided sessions with the right coverage targets.
          </p>

          <dl className="mt-10 space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl border border-indigo-100/80 bg-indigo-50/60 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Smart scaffolding</dt>
              <dd className="mt-2">
                AI builds a clean hierarchy of topics, follow-up areas, and required questions so interviews stay focused.
              </dd>
            </div>
            <div className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Adaptive weighting</dt>
              <dd className="mt-2">
                Every branch receives a weight, letting you prioritize which knowledge gaps to close first.
              </dd>
            </div>
            <div className="rounded-2xl border border-sky-100/80 bg-sky-50/60 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">Instant context</dt>
              <dd className="mt-2">
                Export the map into interviews, dashboards, and documentation without duplicating effort.
              </dd>
            </div>
          </dl>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">Company inputs</h2>
            <p className="text-sm text-slate-500">Use your best elevator pitch&mdash;the richer the context, the smarter the coverage map.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="companyName" className="text-sm font-medium text-slate-700">
              Company name
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Acme Manufacturing"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="url" className="text-sm font-medium text-slate-700">
              Company website URL <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Business description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="We manufacture automotive parts with a focus on precision engineering..."
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Generating topic tree...' : 'Generate topic tree'}
          </button>
        </form>
      </div>

      {topicTree && (
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

          <div className="mt-8 space-y-4">
            {topicTree.topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} level={0} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TopicCard({ topic, level }: { topic: any; level: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-slate-200/80 pl-4' : ''}`}>
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              {topic.name}
              <span className="ml-2 text-xs font-medium text-slate-500">
                Weight {topic.weight}
              </span>
            </h3>
            {topic.targets && topic.targets.length > 0 && (
              <p className="text-xs text-slate-500">
                {topic.targets.length} target question{topic.targets.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {topic.children && topic.children.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>

        {expanded && topic.targets && topic.targets.length > 0 && (
          <ul className="mt-3 space-y-2">
            {topic.targets.map((target: any) => (
              <li key={target.id} className="text-sm text-slate-600">
                <span className={target.required ? 'font-semibold text-rose-500' : 'text-slate-400'}>
                  {target.required ? '* ' : ''}
                </span>
                {target.q}
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && topic.children && topic.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {topic.children.map((child: any) => (
            <TopicCard key={child.id} topic={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

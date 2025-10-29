'use client';

import { useState } from 'react';
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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Seed Topic Tree</h1>
        <p className="mt-2 text-gray-600">
          Generate a knowledge map from your company information
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
            Company Name
          </label>
          <input
            type="text"
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            placeholder="Acme Manufacturing"
          />
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">
            Company Website URL (optional)
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Business Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            placeholder="We manufacture automotive parts with a focus on precision engineering..."
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400"
        >
          {loading ? 'Generating Topic Tree...' : 'Generate Topic Tree'}
        </button>
      </form>

      {topicTree && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Generated Topic Tree</h2>
          <p className="mt-1 text-sm text-gray-500">Company: {topicTree.company}</p>

          <div className="mt-6 space-y-4">
            {topicTree.topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} level={0} />
            ))}
          </div>

          <div className="mt-6 flex gap-4">
            <a
              href="/interview"
              className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Start Interview
            </a>
            <a
              href="/dashboard"
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              View Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, level }: { topic: any; level: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              {topic.name}
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Weight: {topic.weight})
              </span>
            </h3>
            {topic.targets && topic.targets.length > 0 && (
              <p className="mt-1 text-sm text-gray-600">
                {topic.targets.length} target question{topic.targets.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {topic.children && topic.children.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>

        {expanded && topic.targets && topic.targets.length > 0 && (
          <ul className="mt-3 space-y-1">
            {topic.targets.map((target: any) => (
              <li key={target.id} className="text-sm text-gray-700">
                <span className="text-red-600">{target.required ? '* ' : '  '}</span>
                {target.q}
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && topic.children && topic.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {topic.children.map((child: any) => (
            <TopicCard key={child.id} topic={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

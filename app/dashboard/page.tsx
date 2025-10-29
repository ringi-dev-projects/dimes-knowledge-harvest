'use client';

import { useState, useEffect } from 'react';
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Coverage Dashboard</h1>
          <p className="mt-2 text-gray-600">
            {companyName ? `${companyName} - ` : ''}Track knowledge capture progress across all topics
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setUseMockData(!useMockData)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {useMockData ? 'Show Real Data' : 'Show Mock Data'}
          </button>
          <a
            href="/docs/1"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Generate Documentation
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Overall Coverage</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-gray-900">{overallCoverage}%</div>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${overallCoverage}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Confidence Score</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-gray-900">{overallConfidence}%</div>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-500"
              style={{ width: `${overallConfidence}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Topics Covered</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-gray-900">
              {metrics.filter(m => m.coveragePercent > 50).length}
            </div>
            <div className="ml-2 text-sm text-gray-500">of {metrics.length}</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Interviews</div>
          <div className="mt-2 flex items-baseline">
            <div className="text-3xl font-bold text-gray-900">
              {useMockData ? 3 : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Topic Coverage List */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Topic Coverage Details</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading metrics...</div>
        ) : metrics.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="mt-2 text-gray-600">No coverage data yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Start by seeding topics and conducting interviews
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <a
                href="/seed"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                Seed Topics
              </a>
              <button
                onClick={() => setUseMockData(true)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Load Mock Data
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {metrics.map((metric) => (
              <TopicCoverageRow key={metric.topicId} metric={metric} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicCoverageRow({ metric }: { metric: CoverageMetrics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{metric.topicName}</h3>
          <p className="text-sm text-gray-500">
            {metric.answeredQuestions} of {metric.targetQuestions} questions answered
          </p>
        </div>

        <div className="w-64">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Coverage</span>
            <span className="font-medium text-gray-900">{metric.coveragePercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${metric.coveragePercent}%` }}
            />
          </div>
        </div>

        <div className="w-48">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Confidence</span>
            <span className="font-medium text-gray-900">{metric.confidence}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-500"
              style={{ width: `${metric.confidence}%` }}
            />
          </div>
        </div>

        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && metric.nextQuestions && metric.nextQuestions.length > 0 && (
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Next Questions to Ask:</h4>
          <ul className="space-y-1">
            {metric.nextQuestions.slice(0, 5).map((question, idx) => (
              <li key={idx} className="text-sm text-gray-600">
                • {question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

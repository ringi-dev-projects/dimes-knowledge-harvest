'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';

interface DocumentSection {
  id: string;
  title: string;
  content: string;
  subsections?: DocumentSection[];
}

interface DocumentData {
  companyName: string;
  generatedAt: string;
  sections: DocumentSection[];
}

export default function DocumentationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/docs/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setDoc(data.document);
        if (data.document.sections.length > 0) {
          setActiveSection(data.document.sections[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const exportDocument = async (format: 'html' | 'docx') => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/export/docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: resolvedParams.id,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `knowledge-handbook-${resolvedParams.id}.${format === 'docx' ? 'docx' : 'html'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting document:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">No documentation found</p>
          <a href="/dashboard" className="mt-4 text-indigo-600 hover:text-indigo-700">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Table of Contents Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">Knowledge Handbook</h2>
          <p className="mt-1 text-sm text-gray-500">{doc.companyName}</p>
          <p className="mt-1 text-xs text-gray-400">
            Generated {new Date(doc.generatedAt).toLocaleDateString()}
          </p>
        </div>

        <nav className="space-y-1">
          {doc.sections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => setActiveSection(section.id)}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeSection === section.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {section.title}
              </button>
              {section.subsections && section.subsections.length > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {section.subsections.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveSection(sub.id)}
                      className={`block w-full text-left px-3 py-1.5 rounded-md text-xs ${
                        activeSection === sub.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-8 space-y-2">
          <button
            onClick={() => exportDocument('html')}
            disabled={generating}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {generating ? 'Generating...' : 'Download HTML'}
          </button>
          <button
            onClick={() => exportDocument('docx')}
            disabled={generating}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
          >
            {generating ? 'Generating...' : 'Download DOCX'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-12">
          {doc.sections.map((section) => (
            <SectionContent
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function SectionContent({ section, isActive }: { section: DocumentSection; isActive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isActive]);

  return (
    <div ref={ref} id={section.id} className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">{section.title}</h2>
      <div
        className="prose prose-indigo max-w-none"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />

      {section.subsections && section.subsections.length > 0 && (
        <div className="ml-8 mt-8 space-y-8">
          {section.subsections.map((sub) => (
            <div key={sub.id} id={sub.id}>
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">{sub.title}</h3>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sub.content }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

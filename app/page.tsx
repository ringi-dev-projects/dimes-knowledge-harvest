export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Welcome to Knowledge Harvest
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Convert senior employees&apos; tacit know-how into a living, searchable knowledge base
          using voice-first AI interviews.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="/seed"
            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Start with Topic Seed
          </a>
          <a
            href="/dashboard"
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            View Dashboard <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-indigo-600 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Voice-First Capture</h3>
          <p className="mt-2 text-sm text-gray-600">
            Elders speak naturally via browser or phone. AI conducts adaptive interviews and handles all transcription.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-indigo-600 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Coverage Tracking</h3>
          <p className="mt-2 text-sm text-gray-600">
            Auto-generate topic taxonomy, track coverage % and confidence for each area across multiple sessions.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-indigo-600 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">One-Click Docs</h3>
          <p className="mt-2 text-sm text-gray-600">
            Generate formatted handbooks viewable in-browser or export as HTML/DOCX files.
          </p>
        </div>
      </div>
    </div>
  );
}

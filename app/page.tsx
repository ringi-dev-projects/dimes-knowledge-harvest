import Link from "next/link";

export default function Home() {
  return (
    <div className="page-shell space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 px-6 py-16 text-center text-white shadow-2xl shadow-indigo-500/30 sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -right-10 bottom-6 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80 backdrop-blur">
            AI KNOWLEDGE PLATFORM
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Capture and amplify the expertise your business runs on
          </h1>
          <p className="text-lg text-indigo-100 sm:text-xl">
            Knowledge Harvest blends voice-first interviews with adaptive AI guidance so you can map, measure, and share hard-won know-how in days—not months.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/seed"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-600 shadow-lg shadow-indigo-500/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-indigo-500/30"
            >
              Start with Topic Seed
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/10"
            >
              Preview Dashboard
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <dl className="mt-10 grid w-full gap-6 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur">
              <dt className="text-xs font-semibold tracking-wide text-white/70">MINUTES TO SET UP</dt>
              <dd className="mt-3 text-3xl font-semibold">10</dd>
              <p className="mt-1 text-sm text-white/80">Seed targeted question maps in under fifteen minutes.</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur">
              <dt className="text-xs font-semibold tracking-wide text-white/70">LIVE INTERVIEWS</dt>
              <dd className="mt-3 text-3xl font-semibold">Realtime</dd>
              <p className="mt-1 text-sm text-white/80">AI co-pilot adapts prompts as experts speak.</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur">
              <dt className="text-xs font-semibold tracking-wide text-white/70">KNOWLEDGE ASSETS</dt>
              <dd className="mt-3 text-3xl font-semibold">Auto Docs</dd>
              <p className="mt-1 text-sm text-white/80">Instant handbooks, transcripts, and action items.</p>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article className="glass-card">
          <div className="mb-4 inline-flex rounded-full bg-indigo-100 p-3 text-indigo-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Voice-First Capture</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Experts speak naturally on browser or phone while AI interviewers probe, clarify, and flag follow-ups in real time.
          </p>
        </article>

        <article className="glass-card">
          <div className="mb-4 inline-flex rounded-full bg-emerald-100 p-3 text-emerald-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Coverage Tracking</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Visualize topic coverage, confidence, and unanswered questions so you know exactly where to focus next.
          </p>
        </article>

        <article className="glass-card md:col-span-2 lg:col-span-1">
          <div className="mb-4 inline-flex rounded-full bg-sky-100 p-3 text-sky-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Auto-Assembled Deliverables</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Turn captured knowledge into living handbooks, onboarding guides, and SOPs that stay searchable and shareable.
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl ring-1 ring-slate-900/10 backdrop-blur lg:p-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <span className="badge-soft">How it works</span>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              From raw conversations to confident knowledge coverage
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              Knowledge Harvest keeps every step aligned—from mapping topics to interviewing experts and generating documentation—so your organization never loses critical know-how again.
            </p>
            <ul className="space-y-4 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                  1
                </span>
                Seed your knowledge tree with company context and get a prioritized set of interview targets in minutes.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                  2
                </span>
                Run guided voice interviews. The AI interviewer adapts, probes, and creates clean transcripts automatically.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                  3
                </span>
                Track coverage in real time and export polished documentation ready for onboarding or operational playbooks.
              </li>
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -translate-y-6 translate-x-6 rounded-3xl bg-gradient-to-br from-indigo-200 via-white to-sky-200 opacity-75 blur-3xl" />
            <div className="relative grid gap-4">
              <div className="muted-card">
                <h3 className="text-sm font-semibold text-slate-900">Coverage snapshot</h3>
                <p className="mt-2 text-sm text-slate-600">Surfacing the strongest and weakest knowledge areas at a glance.</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Safety protocols</span>
                      <span className="font-semibold text-slate-800">86%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: "86%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Maintenance routines</span>
                      <span className="font-semibold text-slate-800">62%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: "62%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Equipment settings</span>
                      <span className="font-semibold text-slate-800">44%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-pink-500" style={{ width: "44%" }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="muted-card">
                <h3 className="text-sm font-semibold text-slate-900">Next question queue</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• What conditions trigger a line restart?</li>
                  <li>• Which tools need weekly calibration?</li>
                  <li>• How do you triage urgent customer issues?</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

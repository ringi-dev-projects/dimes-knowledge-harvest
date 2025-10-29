Knowledge Harvest MVP - Demo-Ready PoC Plan

🎯 Target: Vercel deployment with SQLite, live voice interviews, and in-app documentation viewer

---
Phase 1: Project Scaffolding (Foundation)

1. Initialize Next.js 14 with TypeScript - App Router, Tailwind CSS
2. Install core dependencies:
- Azure SDK (@azure/openai, @azure/ai-speech, @azure/storage-blob)
- Database (better-sqlite3, drizzle-orm for type-safe queries)
- Document generation (docx, html templates)
- UI components (shadcn/ui for quick, polished UI)
3. Environment setup - .env.local template with Azure keys
4. Database schema - SQLite with tables: companies, topics, interviews, qa_turns, knowledge_atoms, coverage_scores

---
Phase 2: Seed & Topic Generation

1. Seed page (/seed) - Form to input company URL + business description
2. API: /api/seed-map - Use Azure OpenAI with Structured Outputs to generate TopicTree JSON from URL crawl
3. Topic tree viewer - Display generated topics with target questions

---
Phase 3: Live Voice Interview (Core Demo Feature)

1. Interview page (/interview) - WebRTC interface with mic controls
2. API: /api/realtime/session - Create Azure OpenAI Realtime session token
3. WebRTC client - RTCPeerConnection to stream mic ↔ AI voice
4. Real-time coverage tracking - AI uses tool calls to update topic coverage during conversation
5. Post-interview processing - Transcription, diarization, extract knowledge atoms

---
Phase 4: Coverage Dashboard

1. Dashboard page (/dashboard) - Visual progress bars per topic
2. Coverage calculation - answered_targets / total_targets + confidence scoring
3. "Next 10 Questions" list - Show uncovered high-priority questions
4. Mock data mode - Pre-populated sample data for instant demo

---
Phase 5: Documentation Export/Viewer

1. Documentation viewer (/docs/[sessionId]) - In-app formatted handbook view with TOC
2. Export buttons:
- View in browser - Styled HTML handbook with navigation
- Download DOCX - Generate Word doc using docx library
- Download HTML - Static HTML file for offline use
3. API: /api/export/docs - Generate formatted documentation from knowledge atoms

---
Phase 6: Polish & Deploy

1. Layout & navigation - Clean UI with breadcrumbs, consistent styling
2. Error handling - Graceful fallbacks for API failures
3. Loading states - Skeletons and progress indicators
4. Vercel deployment - Configure vercel.json, serverless functions, SQLite persistence strategy
5. Demo script - Step-by-step walkthrough for client calls

---
Key Files to Create

- app/seed/page.tsx - Topic generation form
- app/interview/page.tsx - Voice interview interface
- app/dashboard/page.tsx - Coverage metrics
- app/docs/[id]/page.tsx - Documentation viewer
- app/api/realtime/session/route.ts - Azure Realtime session
- app/api/seed-map/route.ts - Topic tree generation
- app/api/transcribe/route.ts - Speech-to-text + diarization
- app/api/export/docs/route.ts - Document generation
- lib/db/schema.ts - Drizzle ORM schema
- lib/azure/realtime.ts - Azure OpenAI Realtime client
- lib/coverage.ts - Coverage calculation logic

---
Estimated Timeline

- Phase 1-2: 2-3 hours (scaffolding + seed)
- Phase 3: 4-6 hours (voice interview - most complex)
- Phase 4: 2-3 hours (dashboard + metrics)
- Phase 5: 2-3 hours (docs viewer + exports)
- Phase 6: 1-2 hours (polish + deploy)

Total: ~12-17 hours of focused development

---
Demo Flow (5-7 minutes)

1. Show mock data - Pre-populated dashboard with coverage metrics (30s)
2. Seed from scratch - Input client URL, generate topic tree (1-2 min)
3. Live interview - 2-3 minute voice conversation with AI, show real-time coverage updates (3-4 min)
4. View results - Dashboard with updated metrics + "Next Questions" (1 min)
5. Documentation - Generate and view formatted handbook in-browser, offer download (1 min)

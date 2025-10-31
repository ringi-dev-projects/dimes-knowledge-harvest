# Knowledge Harvest - MVP

AI-powered platform to convert senior employees' tacit know-how into searchable, structured knowledge through voice-first interviews.

## Features

### ✅ Production-Ready Features

- **Topic Seed Generation**: Auto-generate knowledge taxonomy from company information using Azure OpenAI
- **Interview Management**: Create and manage interview sessions with transcript storage
- **Knowledge Extraction**: AI-powered extraction of procedures, facts, troubleshooting, and best practices from interviews
- **Coverage Calculation**: Automatic calculation of topic coverage metrics based on interview data
- **Real-Time Dashboard**: Visual progress tracking showing coverage percentage, confidence scores, and next questions
- **Documentation Generation**: Auto-generate formatted documentation from extracted knowledge atoms
- **Multi-Format Export**: Export handbooks as HTML or DOCX
- **Company Context**: Multi-company support with global state management

### 🚧 In Progress

- **Azure Speech Integration**: Enhanced transcription with speaker diarization

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: Vercel Postgres (Neon) with Drizzle ORM
- **AI/ML**: Azure OpenAI (GPT-4, Realtime API), Azure Speech Services
- **Deployment**: Vercel-ready

## Quick Start

### Prerequisites

- Node.js 18+
- Azure OpenAI account with:
  - GPT-4 deployment
  - Realtime API access (gpt-4o-realtime-preview)
  - Speech Services enabled

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment variables:
Copy `.env.example` to `.env.local` and fill in your Azure credentials:

```bash
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME=gpt-4o-realtime-preview
AZURE_OPENAI_REALTIME_REGION=eastus2
AZURE_OPENAI_REALTIME_API_VERSION=2025-04-01-preview
AZURE_OPENAI_REALTIME_VOICE=verse
AZURE_SPEECH_KEY=your_speech_key
AZURE_SPEECH_REGION=japaneast
DATABASE_URL=postgresql://your_user:your_password@your-host/neondb?sslmode=require
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Demo Flow

### Option 1: Quick Demo with Mock Data
1. Go to Dashboard (`/dashboard`)
2. Click "Show Mock Data" button
3. View pre-populated coverage metrics
4. Click "Generate Documentation" to see formatted handbook
5. Export as HTML or DOCX

### Option 2: Full Production Flow with Real Data

**Step 1: Generate Topic Tree**
1. Go to Seed page (`/seed`)
2. Enter company name, URL (optional), and description
3. Click "Generate Topic Tree"
4. AI generates structured knowledge taxonomy
5. Company context is automatically set

**Step 2: Conduct Interview** (Realtime voice + GPT co-pilot)
1. Go to Interview page (`/interview`)
2. Click "Start Interview"
3. Allow microphone access when prompted
4. Speak naturally — audio streams to Azure Realtime GPT which drives the conversation, displays live transcript, and returns synthesized audio
5. Click "Stop Interview" to finish. Audio, transcript, knowledge extraction, and coverage updates run automatically (audio files are stored under `data/interviews/`).

**Step 3: Extract Knowledge** (Optional manual re-run)
```bash
curl -X POST http://localhost:3001/api/knowledge/extract \
  -H "Content-Type: application/json" \
  -d '{"sessionId": 1}'
```

**Step 4: Calculate Coverage** (Optional manual re-run)
```bash
curl -X POST http://localhost:3001/api/coverage/calculate \
  -H "Content-Type: application/json" \
  -d '{"companyId": 1}'
```

**Step 5: View Results**
1. Go to Dashboard (`/dashboard`) - see real coverage metrics
2. Go to Docs (`/docs/1`) - see generated documentation
3. Export as HTML or DOCX

---

## API Endpoints

### Production Endpoints (Real Data)

**Topic Generation**
```
POST /api/seed-map
Body: { companyName, description, url? }
Returns: { success, topicTree, companyId }
```

**Interview Management**
```
POST /api/realtime/session
Body: { companyId }
Returns: { sessionId, clientSecret, webrtcUrl, model, voice, instructions }

POST /api/interview/end
Body: multipart/form-data → sessionId, messages (JSON), audio (binary)
Returns: { success, sessionId, audioUrl }
```

**Knowledge Processing**
```
POST /api/knowledge/extract
Body: { sessionId }
Returns: { success, knowledgeAtoms, atomsExtracted }

POST /api/coverage/calculate
Body: { companyId }
Returns: { success, coverageResults, sessionsProcessed }
```

**Data Retrieval**
```
GET /api/coverage?companyId={id}
Returns: { success, metrics[] }

GET /api/docs/{companyId}
Returns: { success, document }

POST /api/export/docs
Body: { companyId, format: 'html'|'docx' }
Returns: File download
```

---

## Documentation

- **[END-TO-END-FLOW.md](docs/END-TO-END-FLOW.md)** - Complete system architecture and flow
- **[CODEBASE-REVIEW.md](docs/CODEBASE-REVIEW.md)** - Issues and fixes implemented
- **[PRODUCTION-IMPLEMENTATION.md](docs/PRODUCTION-IMPLEMENTATION.md)** - Production features and workflow

## Project Structure

```
├── app/
│   ├── page.tsx                        # Home page
│   ├── seed/page.tsx                   # Topic generation UI
│   ├── interview/page.tsx              # Voice interview interface
│   ├── dashboard/page.tsx              # Coverage metrics dashboard
│   ├── docs/[id]/page.tsx              # Documentation viewer
│   └── api/
│       ├── seed-map/route.ts           # Topic tree generation (Azure OpenAI)
│       ├── interview/
│       │   └── end/route.ts            # Save interview session ✨ NEW
│       ├── realtime/session/route.ts   # Create interview session
│       ├── knowledge/
│       │   └── extract/route.ts        # Extract knowledge atoms ✨ NEW
│       ├── coverage/
│       │   ├── route.ts                # Get coverage metrics
│       │   └── calculate/route.ts      # Calculate coverage ✨ NEW
│       ├── docs/[id]/route.ts          # Generate documentation (real data) ✨ UPDATED
│       └── export/docs/route.ts        # Export as HTML/DOCX
├── lib/
│   ├── db/
│   │   ├── index.ts                    # Database client (improved) ✨ UPDATED
│   │   └── schema.ts                   # Database schema
│   ├── context/
│   │   └── CompanyContext.tsx          # Global company state ✨ NEW
│   └── types.ts                        # TypeScript definitions
├── docs/
│   ├── END-TO-END-FLOW.md              # Architecture documentation
│   ├── CODEBASE-REVIEW.md              # Review findings
│   └── PRODUCTION-IMPLEMENTATION.md     # Production features guide ✨ NEW
├── data/
│   └── knowledge-harvest.db            # SQLite database (auto-created)
└── public/                             # Static assets
```

## Database Schema

- **companies** - Client organizations
- **topic_trees** - Generated knowledge taxonomies
- **interview_sessions** - Interview recordings
- **qa_turns** - Question-answer pairs
- **knowledge_atoms** - Extracted procedures/facts
- **coverage_scores** - Topic coverage metrics

## Deployment to Vercel

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard (Production + Preview + Development)
4. Deploy!

**Note**: For production with SQLite, consider:
- Using Vercel Postgres or other cloud database
- Azure SQL Database for enterprise deployments
- Turso for distributed SQLite

## Next Steps

- [ ] Implement full WebRTC connection to Azure Realtime API
- [ ] Add real-time transcription and diarization
- [ ] Build knowledge extraction pipeline
- [ ] Add authentication and multi-tenancy
- [ ] Implement Azure AI Search for retrieval
- [ ] Add PII redaction and compliance features
- [ ] Create admin panel for company management

## License

MIT

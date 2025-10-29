# Knowledge Harvest - MVP

AI-powered platform to convert senior employees' tacit know-how into searchable, structured knowledge through voice-first interviews.

## Features

- **Topic Seed Generation**: Auto-generate knowledge taxonomy from company information
- **Voice Interviews**: WebRTC-based live interviews with AI interviewer (Azure OpenAI Realtime API)
- **Coverage Tracking**: Visual dashboard showing knowledge capture progress
- **Documentation Export**: Generate formatted handbooks viewable in-browser or export as HTML/DOCX

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: SQLite with Drizzle ORM
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
AZURE_SPEECH_KEY=your_speech_key
AZURE_SPEECH_REGION=japaneast
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

### Option 2: Full Demo from Scratch
1. Go to Seed page (`/seed`)
2. Enter company details and URL
3. Generate topic tree with AI
4. Start voice interview (`/interview`)
5. Conduct live interview with AI
6. View updated coverage on Dashboard
7. Generate and export documentation

## Project Structure

```
├── app/
│   ├── page.tsx                 # Home page
│   ├── seed/page.tsx            # Topic generation
│   ├── interview/page.tsx       # Voice interview interface
│   ├── dashboard/page.tsx       # Coverage metrics
│   ├── docs/[id]/page.tsx       # Documentation viewer
│   └── api/
│       ├── seed-map/route.ts    # Topic tree generation
│       ├── realtime/session/    # Realtime API session
│       ├── coverage/route.ts    # Coverage metrics
│       ├── docs/[id]/route.ts   # Document fetching
│       └── export/docs/route.ts # Document export
├── lib/
│   ├── db/                      # Database schema & client
│   └── types.ts                 # TypeScript definitions
├── data/
│   └── knowledge-harvest.db     # SQLite database (auto-created)
└── public/                      # Static assets
```

## API Routes

- `POST /api/seed-map` - Generate topic tree from company info
- `POST /api/realtime/session` - Create interview session
- `GET /api/coverage?mock=true` - Get coverage metrics
- `GET /api/docs/[id]` - Fetch document
- `POST /api/export/docs` - Export as HTML/DOCX

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
3. Add environment variables in Vercel dashboard
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

# Knowledge Harvest - End-to-End Flow Documentation

This document explains how data flows through the system from initial company setup to final documentation export.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Flow 1: Topic Tree Generation (Seed)](#flow-1-topic-tree-generation-seed)
3. [Flow 2: Live Interview](#flow-2-live-interview)
4. [Flow 3: Coverage Dashboard](#flow-3-coverage-dashboard)
5. [Flow 4: Documentation Export](#flow-4-documentation-export)
6. [Data Models](#data-models)
7. [API Endpoints](#api-endpoints)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface (Next.js)                    │
├─────────────────────────────────────────────────────────────────────┤
│  /seed         /interview       /dashboard        /docs/[id]        │
│  Topic Gen     Voice Chat       Metrics View      Doc Viewer        │
└────────┬──────────────┬─────────────┬───────────────┬───────────────┘
         │              │             │               │
         ▼              ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                           │
├─────────────────────────────────────────────────────────────────────┤
│  /api/seed-map   /api/realtime   /api/coverage   /api/docs         │
│                  /api/interview                   /api/export       │
└────────┬──────────────┬─────────────┬───────────────┬───────────────┘
         │              │             │               │
         ▼              ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     External Services                               │
├─────────────────────────────────────────────────────────────────────┤
│  Azure OpenAI    Azure Speech    SQLite DB       Azure Storage     │
│  (GPT-4, RT)     (STT/TTS)       (Local)         (Audio Files)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Topic Tree Generation (Seed)

### Purpose
Convert company information into a structured knowledge taxonomy with target questions.

### User Journey

```
User → Seed Page → Fill Form → Submit → AI Processing → Topic Tree Display
```

### Step-by-Step Flow

#### Step 1: User Accesses Seed Page
**File**: `app/seed/page.tsx`

```typescript
// User navigates to http://localhost:3001/seed
// Component renders form with three inputs:
// 1. Company Name (required)
// 2. Website URL (optional)
// 3. Business Description (required)
```

**UI State**:
- `companyName`: string
- `url`: string
- `description`: string
- `loading`: boolean
- `topicTree`: TopicTree | null
- `error`: string

---

#### Step 2: User Submits Form
**Trigger**: Click "Generate Topic Tree" button

**Action**: `handleSubmit()` function executes

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  // POST request to API
  const response = await fetch('/api/seed-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,           // e.g., "https://acme.com"
      companyName,   // e.g., "Acme Manufacturing"
      description,   // e.g., "We make automotive parts..."
    }),
  });

  const data = await response.json();
  setTopicTree(data.topicTree);
};
```

---

#### Step 3: API Receives Request
**File**: `app/api/seed-map/route.ts`

**Endpoint**: `POST /api/seed-map`

**Input**:
```json
{
  "url": "https://company.com",
  "companyName": "Acme Manufacturing",
  "description": "We manufacture precision automotive components..."
}
```

**Processing**:

##### 3.1 Fetch Website Content (if URL provided)
```typescript
async function fetchWebsiteContent(url: string): Promise<string> {
  // 1. Fetch HTML from URL
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeHarvest/1.0)',
    },
  });

  // 2. Parse HTML with Cheerio
  const html = await response.text();
  const $ = cheerio.load(html);

  // 3. Remove non-content elements
  $('script, style, nav, footer').remove();

  // 4. Extract text content
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  // 5. Limit to 3000 characters (for LLM context)
  return text.substring(0, 3000);
}
```

**Result**: Plain text summary of the website (3000 chars max)

---

##### 3.2 Construct AI Prompt
```typescript
const systemPrompt = `You are an expert at analyzing companies and creating comprehensive knowledge taxonomies.

Your task: Generate a structured topic tree that captures all critical knowledge areas.

Focus on these categories:
- Products/Services
- Processes and Procedures
- Equipment and Tools
- Suppliers and Vendors
- Safety and Compliance
- Troubleshooting
- Quality Control
- Onboarding

For each topic:
1. Create specific, actionable target questions
2. Mark critical questions as required=true
3. Organize hierarchically with children

Return ONLY valid JSON in this format:
{
  "company": "Company Name",
  "topics": [
    {
      "id": "unique_id",
      "name": "Topic Name",
      "weight": 5,
      "targets": [
        {"id": "t1", "q": "Specific question?", "required": true}
      ],
      "children": []
    }
  ]
}`;

const userPrompt = `Company: ${companyName}

Description: ${description}

${websiteContent ? `Website Content:\n${websiteContent}\n` : ''}

Generate a comprehensive topic tree for capturing this organization's knowledge.`;
```

---

##### 3.3 Call Azure OpenAI
```typescript
const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
});

const response = await client.chat.completions.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  response_format: { type: 'json_object' }, // Force JSON output
  temperature: 0.7,
  max_tokens: 2000,
});

const content = response.choices[0]?.message?.content;
const topicTree: TopicTree = JSON.parse(content);
```

**Azure OpenAI Process**:
1. Receives system + user prompts
2. Analyzes company description + website content
3. Identifies key knowledge areas
4. Generates structured topic hierarchy
5. Creates target questions for each topic
6. Returns JSON matching schema

**Example Output**:
```json
{
  "company": "Acme Manufacturing",
  "topics": [
    {
      "id": "proc_assembly",
      "name": "Assembly Line Process",
      "weight": 5,
      "targets": [
        {"id":"t1", "q":"List all stations and cycle times", "required":true},
        {"id":"t2", "q":"Torque specs per station", "required":true}
      ],
      "children": [
        {
          "id":"proc_assembly_station1",
          "name":"Station 1: Pre-fit",
          "weight": 3,
          "targets":[
            {"id":"t3", "q":"Common defects & fixes", "required":false}
          ]
        }
      ]
    }
  ]
}
```

---

##### 3.4 Store in Database
```typescript
const now = new Date();

// Insert company record
const [company] = await db.insert(companies).values({
  name: companyName,
  url: url || null,
  description,
  createdAt: now,
}).returning();

// Insert topic tree
await db.insert(topicTrees).values({
  companyId: company.id,
  topicData: JSON.stringify(topicTree), // Store as JSON string
  createdAt: now,
});
```

**Database Tables Used**:
- `companies`: Stores company metadata
- `topic_trees`: Stores generated topic hierarchies

---

##### 3.5 Return Response
```typescript
return NextResponse.json({
  success: true,
  topicTree,      // The generated tree
  companyId: company.id,  // For future reference
});
```

---

#### Step 4: UI Displays Topic Tree
**File**: `app/seed/page.tsx`

```typescript
// State updates
setTopicTree(data.topicTree);
setLoading(false);

// Renders TopicCard component for each topic
{topicTree.topics.map((topic) => (
  <TopicCard key={topic.id} topic={topic} level={0} />
))}
```

**TopicCard Component**:
- Shows topic name and weight
- Lists target questions (with * for required)
- Collapsible children (nested topics)
- Expandable/collapsible UI

**User Actions Available**:
- View generated topics
- Expand/collapse sections
- Click "Start Interview" → Navigate to `/interview`
- Click "View Dashboard" → Navigate to `/dashboard`

---

### Data Flow Diagram: Seed Process

```
┌──────────┐
│  User    │
│ (Browser)│
└─────┬────┘
      │ 1. Fill form + submit
      ▼
┌─────────────────┐
│  /seed (React)  │
│  handleSubmit() │
└─────┬───────────┘
      │ 2. POST {url, name, description}
      ▼
┌───────────────────────┐
│ /api/seed-map (API)   │
│                       │
│ 3. fetchWebsiteContent│
│    ↓                  │
│ 4. Construct prompts  │
│    ↓                  │
│ 5. Call Azure OpenAI  │◄─────── Azure OpenAI
│    ↓                  │         (GPT-4)
│ 6. Parse JSON response│
│    ↓                  │
│ 7. Store in DB        │◄─────── SQLite
│    ↓                  │         (companies, topic_trees)
│ 8. Return topicTree   │
└───────┬───────────────┘
        │ 9. JSON response
        ▼
┌─────────────────┐
│  /seed (React)  │
│  Display tree   │
└─────────────────┘
```

---

## Flow 2: Live Interview

### Purpose
Conduct voice-based interview to capture expert knowledge on generated topics.

### User Journey

```
User → Interview Page → Start Interview → Voice Conversation → Transcript Display
```

### Step-by-Step Flow

#### Step 1: User Accesses Interview Page
**File**: `app/interview/page.tsx`

**URL**: `http://localhost:3001/interview`

**Initial State**:
- `isRecording`: false
- `sessionId`: null
- `messages`: []
- `error`: ''

---

#### Step 2: User Clicks "Start Interview"
**Function**: `startInterview()`

```typescript
const startInterview = async () => {
  try {
    // 1. Get user's microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2. Create session with backend
    const response = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 1, // TODO: Get from context
      }),
    });

    const data = await response.json();
    setSessionId(data.sessionId);

    // 3. Set up WebRTC connection
    const pc = new RTCPeerConnection();
    peerConnectionRef.current = pc;

    // 4. Add audio track to connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // 5. Handle incoming audio from AI
    pc.ontrack = (event) => {
      if (audioRef.current && event.streams[0]) {
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play();
      }
    };

    // 6. Create WebRTC offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 7. Start recording state
    setIsRecording(true);

    // 8. Add first message (mock for now)
    addMessage('assistant', 'Hello! I am here to help capture your valuable knowledge...');

  } catch (err) {
    setError(err.message);
  }
};
```

**Current Status**:
- ✅ UI implementation complete
- ✅ Microphone access working
- ✅ WebRTC setup structure in place
- ⚠️ **NOT YET CONNECTED** to Azure Realtime API (mock conversation)

---

#### Step 3: Backend Creates Interview Session
**File**: `app/api/realtime/session/route.ts`

**Endpoint**: `POST /api/realtime/session`

**Input**:
```json
{
  "companyId": 1,
  "speakerName": "John Doe" // optional
}
```

**Processing**:
```typescript
export async function POST(request: NextRequest) {
  const { companyId, speakerName } = await request.json();

  // 1. Create interview session in database
  const now = new Date();
  const [session] = await db.insert(interviewSessions).values({
    companyId,
    speakerName: speakerName || null,
    startedAt: now,
    status: 'active',
  }).returning();

  // 2. In production: Call Azure OpenAI Realtime API
  // const realtimeResponse = await fetch(
  //   `${AZURE_OPENAI_ENDPOINT}/openai/realtime/sessions`,
  //   { method: 'POST', ... }
  // );

  // 3. Return session info (mock for now)
  return NextResponse.json({
    success: true,
    sessionId: session.id,
    sessionToken: 'mock-token-for-demo',
    instructions: getInterviewerInstructions(companyId),
  });
}
```

**Database Insert**:
```sql
INSERT INTO interview_sessions (
  company_id, speaker_name, started_at, status
) VALUES (
  1, 'John Doe', '2025-10-29 21:00:00', 'active'
);
-- Returns: sessionId = 1
```

---

#### Step 4: AI Interviewer Instructions
**Function**: `getInterviewerInstructions()`

```typescript
function getInterviewerInstructions(companyId: number): string {
  return `You are an expert knowledge interviewer for Knowledge Harvest.

Your role:
- Conduct friendly, conversational interviews
- Ask open-ended questions about processes, procedures, equipment
- Listen actively and ask follow-ups for specific details
- Confirm critical information by repeating it back
- Track which topics have been covered

Interview structure:
1. Warm greeting, ask for name and role
2. Explain goal: capture their expertise
3. Ask about main responsibilities
4. For each topic, dig into:
   - Step-by-step procedures
   - Common problems and solutions
   - Critical parameters (tolerances, timings, materials)
   - Safety considerations
   - Tips learned over the years
5. Transition smoothly between topics
6. End with thank you and summary

Tools available:
- update_coverage(topic_id, questions_answered, confidence)
- extract_knowledge_atom(topic_id, type, title, content)

Make them feel heard and appreciated.`;
}
```

**Note**: These instructions would be sent to Azure OpenAI Realtime API to configure the AI interviewer's behavior.

---

#### Step 5: Real-Time Conversation (Future Implementation)

**Architecture** (when fully implemented):

```
┌─────────────┐         WebRTC          ┌──────────────────┐
│  Browser    │◄─────────────────────►  │ Azure OpenAI     │
│  (Mic/Audio)│    Audio Streams         │ Realtime API     │
└─────────────┘                          └──────────────────┘
      │                                           │
      │ Transcript events                        │ Tool calls
      ▼                                           ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes                         │
│  /api/interview/update-coverage                         │
│  /api/interview/extract-knowledge                       │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────┐
│  Database   │
│  (SQLite)   │
└─────────────┘
```

**Current Implementation**:
- Mock conversation display
- Real WebRTC structure in place
- Ready for Realtime API integration

---

#### Step 6: Stop Interview
**Function**: `stopInterview()`

```typescript
const stopInterview = async () => {
  // 1. Close WebRTC connection
  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }

  // 2. Stop audio playback
  if (audioRef.current) {
    audioRef.current.srcObject = null;
  }

  // 3. Update state
  setIsRecording(false);

  // 4. Save interview session
  if (sessionId) {
    await fetch('/api/interview/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages,
      }),
    });
  }
};
```

**Expected API Endpoint** (not yet implemented):
```typescript
// app/api/interview/end/route.ts
export async function POST(request: NextRequest) {
  const { sessionId, messages } = await request.json();

  // Update session with end time and transcript
  await db.update(interviewSessions)
    .set({
      endedAt: new Date(),
      transcript: JSON.stringify(messages),
      status: 'completed',
    })
    .where(eq(interviewSessions.id, sessionId));

  return NextResponse.json({ success: true });
}
```

---

### Data Flow Diagram: Interview Process

```
┌──────────┐
│  User    │
│ (Browser)│
└─────┬────┘
      │ 1. Click "Start Interview"
      ▼
┌────────────────────┐
│ /interview (React) │
│ startInterview()   │
└─────┬──────────────┘
      │ 2. getUserMedia() → Microphone access
      │ 3. POST /api/realtime/session
      ▼
┌────────────────────────┐
│ /api/realtime/session  │
│                        │
│ 1. Create DB session   │◄───── SQLite
│ 2. Return sessionId    │       (interview_sessions)
└─────┬──────────────────┘
      │ 4. SessionId + token
      ▼
┌────────────────────┐
│ /interview (React) │
│                    │
│ 5. Setup WebRTC    │
│ 6. addTrack(audio) │
│ 7. createOffer()   │
└─────┬──────────────┘
      │
      │ 8. [Future] Connect to Azure Realtime API
      │    Audio stream ↔ AI voice responses
      │
      │ 9. Display transcript in real-time
      ▼
┌────────────────────┐
│ Live conversation  │
│ (Voice + Text)     │
└────────────────────┘
```

---

## Flow 3: Coverage Dashboard

### Purpose
Display knowledge capture progress with metrics and visualizations.

### User Journey

```
User → Dashboard → Toggle Mock Data → View Metrics → Export Docs
```

### Step-by-Step Flow

#### Step 1: User Accesses Dashboard
**File**: `app/dashboard/page.tsx`

**URL**: `http://localhost:3001/dashboard`

**Initial State**:
```typescript
const [metrics, setMetrics] = useState<CoverageMetrics[]>([]);
const [loading, setLoading] = useState(true);
const [useMockData, setUseMockData] = useState(false);
```

---

#### Step 2: Load Coverage Data
**Effect Hook**: Runs on mount and when `useMockData` changes

```typescript
useEffect(() => {
  loadMetrics();
}, [useMockData]);

const loadMetrics = async () => {
  setLoading(true);
  try {
    const response = await fetch(`/api/coverage?mock=${useMockData}`);
    if (response.ok) {
      const data = await response.json();
      setMetrics(data.metrics || []);
    }
  } finally {
    setLoading(false);
  }
};
```

---

#### Step 3: API Returns Coverage Metrics
**File**: `app/api/coverage/route.ts`

**Endpoint**: `GET /api/coverage?mock=true|false`

**Processing**:

##### Option A: Mock Data (for demos)
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const useMock = searchParams.get('mock') === 'true';

  if (useMock) {
    // Return pre-populated demo data
    return NextResponse.json({
      success: true,
      metrics: mockMetrics, // 8 pre-defined topics with coverage
    });
  }

  // ... real data logic
}
```

**Mock Data Structure**:
```json
[
  {
    "topicId": "products",
    "topicName": "Products & Services",
    "targetQuestions": 15,
    "answeredQuestions": 12,
    "coveragePercent": 80,
    "confidence": 85,
    "nextQuestions": [
      "What are the warranty terms?",
      "How do you handle custom requests?"
    ]
  },
  // ... 7 more topics
]
```

---

##### Option B: Real Data (from database)
```typescript
const companyId = searchParams.get('companyId');

if (companyId) {
  // 1. Query coverage scores from database
  const scores = await db
    .select()
    .from(coverageScores)
    .where(eq(coverageScores.companyId, parseInt(companyId)));

  // 2. Transform to metrics format
  metrics = scores.map((score) => ({
    topicId: score.topicId,
    topicName: score.topicId, // TODO: Join with topics table
    targetQuestions: score.targetQuestions,
    answeredQuestions: score.answeredQuestions,
    coveragePercent: Math.round(
      (score.answeredQuestions / score.targetQuestions) * 100
    ),
    confidence: Math.round(score.confidence * 100),
    nextQuestions: [], // TODO: Calculate from topic tree
  }));
}

return NextResponse.json({
  success: true,
  metrics,
});
```

---

#### Step 4: Dashboard Displays Metrics
**Components**:

##### Summary Cards
```typescript
// Overall Coverage
const overallCoverage = metrics.length > 0
  ? Math.round(metrics.reduce((acc, m) => acc + m.coveragePercent, 0) / metrics.length)
  : 0;

// Overall Confidence
const overallConfidence = metrics.length > 0
  ? Math.round(metrics.reduce((acc, m) => acc + m.confidence, 0) / metrics.length)
  : 0;

// Topics Covered (>50%)
const topicsCovered = metrics.filter(m => m.coveragePercent > 50).length;
```

**Display**:
- 4 summary cards: Overall Coverage, Confidence, Topics Covered, Interviews
- Topic coverage list with progress bars
- "Next Questions" expandable sections

---

##### TopicCoverageRow Component
```typescript
function TopicCoverageRow({ metric }: { metric: CoverageMetrics }) {
  return (
    <div onClick={() => setExpanded(!expanded)}>
      {/* Topic Name */}
      <h3>{metric.topicName}</h3>
      <p>{metric.answeredQuestions} of {metric.targetQuestions} questions</p>

      {/* Coverage Bar */}
      <div className="progress-bar">
        <div style={{ width: `${metric.coveragePercent}%` }} />
      </div>

      {/* Confidence Bar */}
      <div className="progress-bar">
        <div style={{ width: `${metric.confidence}%` }} />
      </div>

      {/* Next Questions (expanded) */}
      {expanded && (
        <ul>
          {metric.nextQuestions.map(q => <li>{q}</li>)}
        </ul>
      )}
    </div>
  );
}
```

---

### Data Flow Diagram: Dashboard Process

```
┌──────────┐
│  User    │
└─────┬────┘
      │ 1. Navigate to /dashboard
      ▼
┌────────────────────┐
│ /dashboard (React) │
│                    │
│ useEffect: load    │
└─────┬──────────────┘
      │ 2. GET /api/coverage?mock=true
      ▼
┌────────────────────┐
│ /api/coverage      │
│                    │
│ if (mock):         │
│   return mockData  │
│ else:              │
│   query DB         │◄───── SQLite (coverage_scores)
│   calculate %      │
│   return metrics   │
└─────┬──────────────┘
      │ 3. JSON: { metrics: [...] }
      ▼
┌────────────────────┐
│ /dashboard (React) │
│                    │
│ Display:           │
│ - Summary cards    │
│ - Progress bars    │
│ - Next questions   │
└────────────────────┘
```

---

## Flow 4: Documentation Export

### Purpose
Generate formatted documentation from captured knowledge.

### User Journey

```
User → Dashboard → Click "Generate Documentation" → Docs Viewer → Export HTML/DOCX
```

### Step-by-Step Flow

#### Step 1: Navigate to Docs Viewer
**Trigger**: Click "Generate Documentation" button on dashboard

**Route**: `/docs/1` (where 1 is company/session ID)

**File**: `app/docs/[id]/page.tsx`

---

#### Step 2: Load Document Data
```typescript
const resolvedParams = use(params);

useEffect(() => {
  loadDocument();
}, [resolvedParams.id]);

const loadDocument = async () => {
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
  } finally {
    setLoading(false);
  }
};
```

---

#### Step 3: API Returns Document
**File**: `app/api/docs/[id]/route.ts`

**Endpoint**: `GET /api/docs/[id]`

**Current Implementation** (mock data):
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // In production: Query database for actual interview data
  // For now: Return mock document with structured sections

  return NextResponse.json({
    success: true,
    document: mockDocument, // Pre-formatted handbook
  });
}
```

**Mock Document Structure**:
```typescript
const mockDocument = {
  companyName: 'Acme Manufacturing Co.',
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'products',
      title: 'Products & Services',
      content: '<p>Acme Manufacturing specializes in...</p>',
      subsections: [
        {
          id: 'products-engine',
          title: 'Engine Components',
          content: '<h4>Manufacturing Process</h4><ol>...</ol>'
        }
      ]
    },
    // ... more sections
  ]
};
```

---

#### Step 4: Display Document
**Components**:

##### Table of Contents (Sidebar)
```typescript
<aside className="w-64 sidebar">
  <h2>Knowledge Handbook</h2>
  <p>{doc.companyName}</p>

  <nav>
    {doc.sections.map((section) => (
      <button onClick={() => setActiveSection(section.id)}>
        {section.title}
      </button>
    ))}
  </nav>

  {/* Export Buttons */}
  <button onClick={() => exportDocument('html')}>
    Download HTML
  </button>
  <button onClick={() => exportDocument('docx')}>
    Download DOCX
  </button>
</aside>
```

##### Main Content Area
```typescript
<main>
  {doc.sections.map((section) => (
    <div id={section.id}>
      <h2>{section.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: section.content }} />

      {section.subsections?.map((sub) => (
        <div id={sub.id}>
          <h3>{sub.title}</h3>
          <div dangerouslySetInnerHTML={{ __html: sub.content }} />
        </div>
      ))}
    </div>
  ))}
</main>
```

---

#### Step 5: Export Document
**Function**: `exportDocument(format: 'html' | 'docx')`

```typescript
const exportDocument = async (format: 'html' | 'docx') => {
  setGenerating(true);

  try {
    // Call export API
    const response = await fetch(`/api/export/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: resolvedParams.id,
        format,
      }),
    });

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-handbook-${resolvedParams.id}.${format === 'docx' ? 'docx' : 'html'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } finally {
    setGenerating(false);
  }
};
```

---

#### Step 6: Generate Export File
**File**: `app/api/export/docs/route.ts`

**Endpoint**: `POST /api/export/docs`

**Input**:
```json
{
  "companyId": "1",
  "format": "html" // or "docx"
}
```

##### HTML Export
```typescript
if (format === 'html') {
  const html = generateHTML(mockContent);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="handbook-${companyId}.html"`,
    },
  });
}
```

**`generateHTML()` Function**:
- Creates full HTML document with CSS
- Includes table of contents
- Formats sections with proper headings
- Adds footer with generation date

---

##### DOCX Export
```typescript
if (format === 'docx') {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `${content.companyName} - Knowledge Handbook`,
            heading: HeadingLevel.TITLE,
          }),
          // ... sections and content
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8Array = new Uint8Array(buffer);

  return new NextResponse(uint8Array, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="handbook-${companyId}.docx"`,
    },
  });
}
```

**Uses**: `docx` library to create Microsoft Word documents

---

### Data Flow Diagram: Documentation Export

```
┌──────────┐
│  User    │
└─────┬────┘
      │ 1. Click "Generate Documentation"
      ▼
┌────────────────────┐
│ /dashboard         │
│ Navigate to:       │
│ /docs/1            │
└─────┬──────────────┘
      │ 2. GET /api/docs/1
      ▼
┌────────────────────┐
│ /api/docs/[id]     │
│                    │
│ 1. Query DB        │◄───── SQLite (interviews, knowledge_atoms)
│ 2. Format sections │
│ 3. Return document │
└─────┬──────────────┘
      │ 3. JSON: { document: {...} }
      ▼
┌────────────────────┐
│ /docs/[id] (React) │
│                    │
│ Display:           │
│ - TOC sidebar      │
│ - Content sections │
│ - Export buttons   │
└─────┬──────────────┘
      │ 4. Click "Download HTML" or "Download DOCX"
      │ POST /api/export/docs
      ▼
┌────────────────────┐
│ /api/export/docs   │
│                    │
│ if (html):         │
│   generateHTML()   │
│ if (docx):         │
│   create Document  │
│   Packer.toBuffer()│
│                    │
│ Return file blob   │
└─────┬──────────────┘
      │ 5. File download
      ▼
┌────────────────────┐
│ Browser downloads  │
│ handbook.html or   │
│ handbook.docx      │
└────────────────────┘
```

---

## Data Models

### TopicTree
```typescript
interface TopicTree {
  company: string;
  topics: Topic[];
}

interface Topic {
  id: string;          // e.g., "proc_assembly"
  name: string;        // e.g., "Assembly Line Process"
  weight: number;      // 1-10, importance ranking
  targets: TopicTarget[];
  children?: Topic[];  // Nested subtopics
}

interface TopicTarget {
  id: string;          // e.g., "t1"
  q: string;           // The question to answer
  required: boolean;   // Must be answered for coverage
}
```

---

### CoverageMetrics
```typescript
interface CoverageMetrics {
  topicId: string;
  topicName: string;
  targetQuestions: number;      // Total questions for this topic
  answeredQuestions: number;    // How many have been answered
  coveragePercent: number;      // (answered / target) * 100
  confidence: number;           // 0-100, quality score
  nextQuestions: string[];      // Unanswered questions
}
```

---

### InterviewSession
```typescript
interface InterviewSession {
  id: number;
  companyId: number;
  speakerName?: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'failed';
  messages: InterviewMessage[];
}

interface InterviewMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  topicId?: string;  // Which topic was being discussed
}
```

---

### KnowledgeAtom
```typescript
interface KnowledgeAtom {
  topic_id: string;
  type: 'procedure' | 'parameter' | 'risk' | 'vendor' | 'troubleshooting';
  title: string;
  steps?: ProcedureStep[];        // For procedures
  parameters?: Record<string, any>; // For measurements, specs
  risks?: string[];               // For safety warnings
  source: KnowledgeAtomSource;
}

interface ProcedureStep {
  n: number;        // Step number
  text: string;     // Step description
}

interface KnowledgeAtomSource {
  session_id: string;
  speaker: string;
  span: string;     // e.g., "00:03:11-00:05:04"
}
```

---

## API Endpoints

### Complete Endpoint Reference

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/seed-map` | Generate topic tree from company info | ✅ Working |
| POST | `/api/realtime/session` | Create interview session | ✅ Working (mock) |
| POST | `/api/interview/end` | Save completed interview | ❌ Not implemented |
| GET | `/api/coverage?mock=true` | Get coverage metrics | ✅ Working |
| GET | `/api/docs/[id]` | Get formatted documentation | ✅ Working (mock) |
| POST | `/api/export/docs` | Export as HTML/DOCX | ✅ Working |

---

### Request/Response Examples

#### POST /api/seed-map
**Request**:
```json
{
  "url": "https://acme.com",
  "companyName": "Acme Manufacturing",
  "description": "We manufacture automotive components"
}
```

**Response**:
```json
{
  "success": true,
  "topicTree": {
    "company": "Acme Manufacturing",
    "topics": [...]
  },
  "companyId": 1
}
```

---

#### GET /api/coverage?mock=true
**Response**:
```json
{
  "success": true,
  "metrics": [
    {
      "topicId": "products",
      "topicName": "Products & Services",
      "targetQuestions": 15,
      "answeredQuestions": 12,
      "coveragePercent": 80,
      "confidence": 85,
      "nextQuestions": ["Question 1", "Question 2"]
    }
  ]
}
```

---

#### POST /api/export/docs
**Request**:
```json
{
  "companyId": "1",
  "format": "docx"
}
```

**Response**: Binary file (DOCX or HTML)

---

## Current Implementation Status

### ✅ Fully Working
- Topic tree generation (with Azure OpenAI)
- Mock data display on dashboard
- Documentation viewer UI
- HTML/DOCX export

### ⚠️ Partial Implementation
- Interview UI (ready for Realtime API connection)
- WebRTC setup (structure in place, needs Azure connection)
- Database schema (created, needs population from interviews)

### ❌ Not Yet Implemented
- Azure OpenAI Realtime API integration
- Real-time transcription and diarization
- Knowledge extraction from interviews
- Coverage calculation from actual interviews
- `/api/interview/end` endpoint
- Real coverage metrics (currently mock only)

---

## Next Steps for Full Implementation

1. **Connect Azure Realtime API**
   - Implement WebRTC signaling
   - Handle tool calls from AI
   - Process real-time transcripts

2. **Implement Knowledge Extraction**
   - Parse interview transcripts
   - Extract procedures, parameters, risks
   - Store as knowledge atoms

3. **Build Coverage Calculator**
   - Map answers to target questions
   - Calculate confidence scores
   - Identify gaps

4. **Complete Interview Endpoints**
   - `/api/interview/end` - Save session
   - `/api/interview/update-coverage` - Real-time updates
   - `/api/interview/extract-knowledge` - Tool call handler

5. **Migrate to Real Data**
   - Replace mock data with DB queries
   - Generate docs from knowledge atoms
   - Calculate real metrics

---

**This documentation will be updated as features are fully implemented.**

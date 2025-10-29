# Codebase Review & Issues

## Review Findings

### ✅ Working Features

1. **Topic Tree Generation** (`/seed`)
   - ✅ UI renders correctly
   - ✅ Form validation working
   - ✅ API endpoint functional
   - ✅ Azure OpenAI integration working
   - ✅ Database storage working
   - ✅ Response display working

2. **Dashboard** (`/dashboard`)
   - ✅ UI renders correctly
   - ✅ Mock data toggle working
   - ✅ API endpoint functional
   - ✅ Progress bars displaying
   - ✅ Summary cards calculating

3. **Documentation Viewer** (`/docs/[id]`)
   - ✅ UI renders correctly
   - ✅ Table of contents working
   - ✅ Content display working
   - ✅ Mock data loading

4. **Export Functionality**
   - ✅ HTML export working
   - ✅ DOCX export working
   - ✅ File download working

---

## ❌ Issues Found

### Issue 1: Missing `/api/interview/end` Endpoint

**Location**: Referenced in `app/interview/page.tsx:79`

**Error**:
```
POST /api/interview/end 404 in 454ms
```

**Impact**: Interview sessions cannot be saved when user clicks "Stop Interview"

**Fix Required**: Create the endpoint

---

### Issue 2: Database Not Initializing Properly

**Location**: `lib/db/index.ts`

**Problem**: SQLite database imports at module level, may cause issues in serverless

**Current Code**:
```typescript
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite, { schema });
initDb(); // Called at module load
```

**Potential Issue**: In serverless environments, this could cause connection issues

---

### Issue 3: Missing Error Handling in Seed API

**Location**: `app/api/seed-map/route.ts`

**Problem**: No validation for empty Azure OpenAI response

**Current Code**:
```typescript
const content = response.choices[0]?.message?.content;
if (!content) {
  throw new Error('No response from AI');
}
const topicTree: TopicTree = JSON.parse(content);
```

**Risk**: JSON.parse could throw if content is malformed

---

### Issue 4: Hardcoded Company ID

**Location**: Multiple files

**Problem**: Company ID is hardcoded to 1

Files affected:
- `app/interview/page.tsx:36` - `companyId: 1`
- No context provider for current company

**Impact**: Can't interview multiple companies

---

### Issue 5: WebRTC Not Actually Connected

**Location**: `app/interview/page.tsx`

**Status**: Structure in place but not connected to Azure Realtime API

**Current**: Mock implementation with placeholder message

**Needs**: Full Realtime API integration

---

## 🔧 Fixes to Implement

### Fix 1: Create Missing Interview End Endpoint

**File to create**: `app/api/interview/end/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Update session with completion data
    await db
      .update(interviewSessions)
      .set({
        endedAt: new Date(),
        transcript: JSON.stringify(messages),
        status: 'completed',
      })
      .where(eq(interviewSessions.id, sessionId));

    return NextResponse.json({
      success: true,
      message: 'Interview saved successfully',
    });
  } catch (error) {
    console.error('Error ending interview:', error);
    return NextResponse.json(
      { error: 'Failed to save interview' },
      { status: 500 }
    );
  }
}
```

---

### Fix 2: Add Error Handling to Seed API

**File**: `app/api/seed-map/route.ts`

**Add**:
```typescript
try {
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  let topicTree: TopicTree;
  try {
    topicTree = JSON.parse(content);
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    throw new Error('AI returned invalid JSON');
  }

  // Validate structure
  if (!topicTree.company || !Array.isArray(topicTree.topics)) {
    throw new Error('AI returned invalid topic tree structure');
  }

  // Continue with database storage...
} catch (error) {
  console.error('Error in seed-map:', error);
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    },
    { status: 500 }
  );
}
```

---

### Fix 3: Add Company Context Provider

**File to create**: `lib/context/CompanyContext.tsx`

```typescript
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CompanyContextType {
  companyId: number | null;
  setCompanyId: (id: number) => void;
  companyName: string | null;
  setCompanyName: (name: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  return (
    <CompanyContext.Provider value={{ companyId, setCompanyId, companyName, setCompanyName }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
```

**Update** `app/layout.tsx`:
```typescript
import { CompanyProvider } from '@/lib/context/CompanyContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CompanyProvider>
          <nav>...</nav>
          <main>{children}</main>
        </CompanyProvider>
      </body>
    </html>
  );
}
```

---

### Fix 4: Database Connection Improvements

**File**: `lib/db/index.ts`

**Update to lazy initialization**:
```typescript
let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getDb() {
  if (!dbInstance) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = process.env.DATABASE_URL || path.join(dataDir, 'knowledge-harvest.db');
    sqliteInstance = new Database(dbPath);
    sqliteInstance.pragma('journal_mode = WAL');

    dbInstance = drizzle(sqliteInstance, { schema });

    // Initialize tables
    initDb(sqliteInstance);
  }

  return dbInstance;
}

export const db = getDb();

function initDb(sqlite: Database.Database) {
  sqlite.exec(`/* SQL table creation */`);
}
```

---

### Fix 5: Add Proper Loading States

**File**: `app/seed/page.tsx`

**Add spinners and better error display**:
```typescript
{loading && (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    <p className="ml-4 text-gray-600">Generating topic tree...</p>
  </div>
)}

{error && (
  <div className="rounded-md bg-red-50 p-4 border border-red-200">
    <div className="flex">
      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
      </svg>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Error generating topic tree</h3>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    </div>
  </div>
)}
```

---

## 🧪 Testing Checklist

### Manual Testing Steps

#### Test 1: Seed Flow
- [ ] Navigate to `/seed`
- [ ] Fill in company name: "Test Company"
- [ ] Fill in description: "We test software"
- [ ] Click "Generate Topic Tree"
- [ ] Verify loading spinner appears
- [ ] Verify topic tree displays
- [ ] Check browser console for errors
- [ ] Verify data saved in database

**Expected**: Topic tree appears, no console errors

---

#### Test 2: Dashboard Mock Data
- [ ] Navigate to `/dashboard`
- [ ] Click "Show Mock Data"
- [ ] Verify 8 topics appear
- [ ] Check progress bars render
- [ ] Expand a topic
- [ ] Verify "Next Questions" display

**Expected**: All metrics display correctly

---

#### Test 3: Interview UI
- [ ] Navigate to `/interview`
- [ ] Click "Start Interview"
- [ ] Allow microphone access
- [ ] Verify recording indicator shows
- [ ] Click "Stop Interview"
- [ ] Check console for 404 error on `/api/interview/end`

**Expected**: UI works, but endpoint is missing (known issue)

---

#### Test 4: Documentation
- [ ] Navigate to `/docs/1`
- [ ] Verify TOC displays
- [ ] Click through sections
- [ ] Scroll to verify navigation
- [ ] Click "Download HTML"
- [ ] Click "Download DOCX"

**Expected**: Both exports download successfully

---

### API Testing

```bash
# Test seed-map (requires Azure OpenAI)
curl -X POST http://localhost:3001/api/seed-map \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Co",
    "description": "We test things",
    "url": ""
  }'

# Test coverage (mock)
curl http://localhost:3001/api/coverage?mock=true

# Test realtime session
curl -X POST http://localhost:3001/api/realtime/session \
  -H "Content-Type: application/json" \
  -d '{"companyId": 1}'

# Test docs
curl http://localhost:3001/api/docs/1

# Test export
curl -X POST http://localhost:3001/api/export/docs \
  -H "Content-Type: application/json" \
  -d '{"companyId":"1","format":"html"}' \
  --output test.html
```

---

## 📊 Current Status Summary

### Working (No Changes Needed)
- ✅ Home page
- ✅ Seed page UI
- ✅ Seed API (with Azure OpenAI)
- ✅ Dashboard UI
- ✅ Coverage API (mock mode)
- ✅ Docs viewer UI
- ✅ Docs API (mock mode)
- ✅ Export API (HTML/DOCX)

### Needs Fixes (High Priority)
- ❌ Create `/api/interview/end` endpoint
- ⚠️ Add error handling in seed API
- ⚠️ Add company context provider
- ⚠️ Improve database initialization

### Future Enhancements (Low Priority)
- 🔄 Connect Azure Realtime API
- 🔄 Implement knowledge extraction
- 🔄 Real coverage calculation
- 🔄 Add authentication
- 🔄 Multi-company support

---

## 🎯 Priority Fixes for Next Session

1. **Create `/api/interview/end` endpoint** (15 min)
2. **Add error handling to seed API** (10 min)
3. **Test seed flow end-to-end** (10 min)
4. **Verify all API endpoints respond correctly** (10 min)

**Total estimated time: 45 minutes**

After these fixes, the MVP will be fully functional for demos with mock data and topic generation.

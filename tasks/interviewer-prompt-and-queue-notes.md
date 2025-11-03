# Interviewer Prompt & Question Queue Redesign

This document outlines changes required to reduce repetitive answer recitation, increase transparency of upcoming questions, and gather feedback on prompt quality. It coordinates the P0 tasks listed under “Interviewer prompt design & coverage explainability” in `tasks/interview-improvement-progress.md`.

## Prompt Strategy Updates

### Goals
- Encourage the AI interviewer to acknowledge answers succinctly and move on, rather than restating entire responses.
- Provide explicit instructions for when to clarify, summarize, or escalate to follow-up questions.
- Maintain a respectful, collaborative tone in both English and Japanese locales while minimizing latency.

### Draft System Prompt Structure
Replace the existing instructions in `app/api/realtime/session/route.ts:205-264` with locale-aware templates that include:

1. **Conversation framing**
   - “You are here to capture operational know-how efficiently; keep responses concise and forward-moving.”
2. **Clarification heuristic**
   - Only paraphrase if confidence < 0.6 or critical data (numbers, names, safety steps) appear uncertain.
3. **Question cadence**
   - After acknowledging, transition to the next unanswered target question; reference the queue provided by the client.
4. **Time awareness**
   - Respect the selected session length; if `remaining_minutes ≤ 3`, ask for critical gaps only.
5. **Feedback hooks**
   - When the expert gives a concise answer, provide a positive nudge instead of repeating content (“Great, thanks—let’s cover …”).

Pseudocode snippet for injection:
```ts
const interviewerProfile = {
  acknowledgement: 'Use short acknowledgements (<= 12 words). Summaries only when confidence is low or user requests it.',
  followups: 'Prioritize questions from the `nextTargets` queue. When none remain, probe for risks, exceptions, or documentation references.',
  tone: 'Warm, respectful, time-aware. Avoid repeating the expert verbatim.',
};
```

### Locale Variants
- Provide separate translations for Japanese prompts with culturally appropriate phrasing (“ありがとうございます。では次に…”).
- Use shared JSON templates so future locales can inherit the same structure.

## Question Queue UX

### UI Additions (`app/interview/page.tsx`)
- **Current Question Card**
  - Positioned above the transcript panel, showing the Active question text, optional bullet points, and a “Why this question?” tooltip that references the topic/target.
  - Includes a “Mark as answered” action to let the interviewer manually advance if the AI misses context.
- **Next Up List**
  - Sidebar section listing the next 2–3 target questions, pulled from the topic tree’s prioritized targets.
  - Each item displays topic tag, required flag, and estimated time cost (short/medium/deep).
- **Feedback chips**
  - After each AI question, show 👍 / 👎 quick feedback. Store results in state and send to `/api/interview/feedback` for later prompt tuning.

### Data Flow
1. **Queue Assembly**
   - When an interview session starts, fetch `/api/topic-tree/latest` and generate an ordered queue prioritizing required targets and low coverage topics.
   - Pass a trimmed queue (`nextTargets`) to the realtime session via the data channel (e.g., `session.update` payload).
2. **Progress Updates**
   - When coverage tool calls indicate completion of a target, mark it as answered client-side and pop it off the queue.
   - If the AI diverges, allow manual skip/drag controls so the interviewer can reprioritize live.
3. **Persistence**
   - Save queue state + feedback in the autosave payload to resume accurately after reconnects.

## Implementation Tasks
1. Build a `useQuestionQueue` hook that:
   - Accepts topic tree + coverage metrics.
   - Outputs `current`, `next[]`, and helpers for `markAnswered`, `skip`, `requeue`.
   - Synchronizes with websocket `update_coverage` tool calls.
2. Create UI components:
   - `CurrentQuestionCard` (with tooltip & manual controls).
   - `QuestionQueueList` (interactive list for the sidebar).
   - `PromptFeedbackChips`.
3. Modify realtime bootstrap (`sendSessionBootstrap` in `app/interview/page.tsx:303-343`) to include `nextTargets` array and remaining session minutes.
4. Refactor system prompt builder in `app/api/realtime/session/route.ts` to consume locale templates and interviewer profile metadata.
5. Add `/api/interview/feedback` endpoint (POST) to log question feedback, targeted for analytics (future personalization).

## Success Measures
- AI recap utterances reduce by ≥60% (tracked via keyword detection in assistant messages).
- ≥80% of sessions show at least one manual queue interaction (skip/mark), indicating visibility and control.
- Thumb feedback captured for ≥50% of AI questions during pilot, enabling data-driven prompt tuning.

## Open Questions
- Should the “Current question” card be editable to adjust phrasing mid-session?
- Do we need a dedicated “Hold on this topic” control if experts want to dive deeper before moving on?
- How do we surface queue controls for mobile users without crowding the layout?

## Implementation Status (2025-11-04)
- ✅ Queue state and controls live in `app/interview/page.tsx` with autosave/resume support and data-channel updates.
- ✅ System prompt updated to follow the queue and minimise recaps (`app/api/realtime/session/route.ts`).
- ✅ Feedback chips persist ratings via `/api/interview/feedback` and analytics events.
- 🔄 Follow-up: evaluate mobile layout adjustments and integrate queue analytics into dashboards.

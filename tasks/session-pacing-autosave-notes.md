# Session Pacing & Autosave Design Notes

These notes translate the P0 requirement for session pacing guardrails into concrete UX and engineering work. Align this document with the checklist under “Session pacing & fatigue guardrails” in `tasks/interview-improvement-progress.md`.

## UX Flows

### Pre-interview setup
- Add a “Session length” selector to the interview start panel with radio buttons:
  1. `15 minutes (recommended)`
  2. `30 minutes (deep dive)`
  3. `No limit (manual wrap-up)` – requires confirming a tooltip about fatigue risk.
- Persist the selection in localStorage so repeat interviewers keep their preference.
- If the user chooses “No limit”, display a secondary dropdown allowing them to enable optional reminders (e.g., every 20 minutes).

### In-session timer UI
- Display the countdown pill next to the existing status badge (`app/interview/page.tsx:1073-1080`), with color ramps:
  - Neutral (`text-slate-500`) until 5 minutes remain.
  - Amber background when ≤5 minutes remain.
  - Red background when ≤1 minute remains.
- Provide a subtle chime (Web Audio) and text banner at the 2-minute and 1-minute marks. For accessibility, also render the reminder text inside the transcript panel.
- For “No limit” sessions, the pill shows elapsed time and optional reminder cadence (“Next break check-in in 5 min”).

### Auto wrap-up experience
- When the timer hits zero, trigger a modal: “Let’s pause here to save your knowledge. Want a 60-second wrap-up?” with `Wrap up now` (default) and `Extend by 5 minutes` (one-time extension per session).
- If the user takes no action, automatically call `stopInterview()` after 60 seconds, then surface the post-session panel.
- Extensions reset the countdown with a shorter reminder window (e.g., Amber at 2 minutes, Red at 30 seconds).

### Resumable flow
- After wrap-up, show a “Schedule a follow-up” button that pre-selects high-priority topics. Pressing it opens a lightweight wizard that sets up a new session with the remaining coverage gaps.
- Store unfinished topics in a new `pendingTopics` table or reuse coverage gaps to seed the next session.

## Autosave Strategy

### Checkpoint cadence
- Autosave every 60 seconds or after each completed user utterance, whichever comes first.
- Persist the following payload to `/api/interview/autosave` (new API):
  - `sessionId`
  - `messages` delta since last save
  - `timerState` (selected option, seconds remaining, extension count)
  - `coverageSnapshots` (current coverage to restore the sidebar)
- Store last autosave timestamp in `sessionStorage` to avoid duplicate posts if offline.

### Failure handling
- If an autosave fails, enqueue retries with exponential backoff and display a subtle “Reconnecting…” toast.
- After three failures, offer a manual “Save progress” button near the transcript.
- When the user refreshes, attempt to resume by fetching `/api/interview/autosave?sessionId=…` and repopulating state before reconnecting WebRTC.

### Resume handshake
- On resume, show a panel summarizing elapsed time and remaining minutes, allowing the user to shorten or continue.
- If the limit passed while offline, prompt them to wrap up immediately.

## Analytics & Telemetry
- Emit `interview_timer_selected`, `interview_timer_warning`, `interview_timer_extended`, and `interview_autowrap` events with properties:
  - `selectedDuration`, `secondsRemaining`, `extensionCount`, `autoStopped`.
- Track `autosave_interval_seconds` and `autosave_failures` to validate the ≤90 second checkpoint requirement.
- Log `wrap_up_modal_shown` and `wrap_up_auto_closed` for adoption analysis.

## Technical Tasks
1. Extend the interview start form (or create a pre-session modal) to capture timer selection and persist it via `useCompany` context or localStorage.
2. Introduce a `useSessionTimer` hook managing countdowns, reminders, and extensions; integrate with `startInterview` and `stopInterview` flows.
3. Build an `AutosaveManager` utility that buffers messages and timer state, posts to the new API, and restores on mount.
4. Create `/api/interview/autosave` for upserts into a new `interview_autosaves` table (sessionId, payload JSON, updatedAt).
5. Update analytics instrumentation (Segment/OpenTelemetry) to capture the new events and ensure dashboards expose compliance with success metrics.

## Implementation Status (2025-11-04)
- Timer presets, countdown UI, reminders, and wrap-up modal implemented in `app/interview/page.tsx` with resume-aware defaults.
- Autosave pipeline delivered via `app/api/interview/autosave/route.ts` and the `interview_autosaves` table; client dispatches checkpoints every ~60s and on transcript progress.
- Analytics events emitted through `fireAnalyticsEvent` for option selection, reminders, extensions, resume/discard actions, and wrap-up prompts.

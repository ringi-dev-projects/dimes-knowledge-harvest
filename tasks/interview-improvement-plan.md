# Interview Feedback Improvement Plan

This plan distills the interview feedback in `docs/tasks/feedbacks.md` alongside the current implementation to define the next wave of improvements. Priority tags use **P0** (blocking trust/adoption), **P1** (important for polish & scale), and **P2** (emerging opportunities). Progress is tracked in `tasks/interview-improvement-progress.md`.

## Top Themes
- **P0 · Session pacing & fatigue** — Interviews stretched past 30 minutes and tired participants; there is no timer or break guidance (`app/interview/page.tsx:82-123`).
- **P0 · Transcript & agent trust** — On-screen Japanese text lags behind the audio quality, messages fragment, and the agent repeats answers (`docs/tasks/feedbacks.md:3-7`; `app/interview/page.tsx:40`, `app/api/realtime/session/route.ts:213-235`).
- **P0 · Coverage accuracy & explainability** — The progress meter overstates coverage because calculation logic is placeholder and ignores multiple sessions (`docs/tasks/feedbacks.md:8,12`; `app/api/coverage/calculate/route.ts:56-95`).
- **P1 · Guidance & deliverables** — Participants want a knowledge graph, textual prompts, mobile stability, and easier access to final scripts (`docs/tasks/feedbacks.md:5,12-16`).
- **P2 · Habit loops** — Weekly highlight/lowlight captures could drive continuous knowledge harvesting (`docs/tasks/feedbacks.md:17`).

## Detailed Opportunities

### 1. Guardrails for session pacing & fatigue (P0)
**Feedback**: `docs/tasks/feedbacks.md:1-3,15`  
**Observation**: Interviews only end when the user clicks stop; there is no timer, autosave, or pacing hint (`app/interview/page.tsx:1004-1033`).  
-**Actions**:
- Add a visible countdown with selectable targets (e.g., **15 minutes default** and **30-minute deep dive**) plus a “no cap” option for edge cases. Pre-break reminders (2–3 minutes beforehand) help land the session gracefully.
- Implement background checkpoint saves (e.g., every 2-3 minutes) so transcripts/audio are not lost if the browser closes early.
- Provide a “Continue later” workflow that spins up a follow-on session seeded with the uncovered topics.
- Track session length metrics in analytics to tune the default cap once more data arrives.

**Recommendation**: Ship with the 15/30 minute presets first (supports short and standard sessions) and gate “no limit” behind an explicit toggle so fatigue warnings still appear.

### 2. Transcript accuracy & readability (P0)
**Feedback**: `docs/tasks/feedbacks.md:3-6,14`  
**Observation**: The UI streams `whisper-1` transcripts (`app/interview/page.tsx:40`) and writes deltas directly to the chat log (`app/interview/page.tsx:476-520,1188-1205`), leading to fragmented bubbles and sub-par Japanese accuracy.  
**Actions**:
- Pilot Azure Speech SDK (neural multi-lingual) for streaming STT with custom vocabularies; fall back to OpenAI only when latency allows.
- Add sentence-level post-processing that merges interim chunks into paragraphs (per itemId) before committing to `messagesRef`.
- Surface both “live draft” and “final verified” transcripts so experts can see corrections in place.
- Build a lightweight reviewer panel that highlights suspected mistranscriptions for manual confirmation during or right after the session.

### 3. Interviewer prompt design & question visibility (P0)
**Feedback**: `docs/tasks/feedbacks.md:4,6,14`  
**Observation**: Current instructions explicitly encourage repeating participant answers (`app/api/realtime/session/route.ts:213-235`), and questions are only heard, not previewed.  
**Actions**:
- Rewrite system instructions to limit paraphrasing to brief confirmations when confidence is low; bias the agent toward asking the next question instead of reciting.
- Add a “Current question” card that displays the prompt text and clarifying bullets before/while the AI speaks.
- Introduce a “Next up” queue (fed by topic targets) so experts can orient themselves and decide whether to jump ahead.
- Capture user feedback on each prompt (quick thumbs up/down) to fine-tune prompt engineering and future sequencing.

### 4. Coverage analytics & explainability (P0)
**Feedback**: `docs/tasks/feedbacks.md:8,12`  
**Observation**: Coverage currently grabs QA pairs from only the first session id and infers confidence from answer length (`app/api/coverage/calculate/route.ts:56-95`), so metrics inflate quickly.  
**Actions**:
- Index coverage per topic target by matching to extracted knowledge atoms (`app/api/knowledge/extract/route.ts:121-198`) and aggregate across *all* completed sessions.
- Track evidence count, recency, and corroboration (multiple sessions) to compute confidence rather than word count heuristics.
- Display “Why this %?” tooltips listing the answered targets and linked transcript spans to restore trust.
- Add regression tests that simulate multi-session data to ensure the coverage API handles growth safely.

### 5. Knowledge graph & guided coverage (P1)
**Feedback**: `docs/tasks/feedbacks.md:12`  
**Observation**: The interview sidebar only lists linear progress bars (`app/interview/page.tsx:123-195`); the topic tree structure is not visible.  
**Actions**:
- Render the topic tree (`TopicNode` graph) as an interactive radial or hierarchical map that highlights covered vs. pending nodes.
- Allow tapping a node to preview its target questions, outstanding follow-ups, and related knowledge atoms.
- Persist “coverage snapshots” per session so the dashboard can show progression over time and identify plateaus.

### 6. Deliverable access & dashboard visibility (P1)
**Feedback**: `docs/tasks/feedbacks.md:14-16`  
**Observation**: After a session the UI offers dashboard/doc links (`app/interview/page.tsx:1215-1234`), but the dashboard requires manual company selection and lacks transcript previews.  
**Actions**:
- Auto-navigate to the latest session summary card with transcript snippets and downloadable audio.
- Add a “Final script” view on the dashboard that stitches the cleaned transcript and knowledge atoms into a shareable artifact.
- Ensure the dashboard refreshes immediately when `/api/interview/end` completes by invalidating SWR/cache and pushing toast notifications.
- Remain open to new UX surfaces (e.g., dedicated “Session Summary” or “Insights” pages) as needed; the roadmap is not constrained to current navigation.

### 7. Mobile reliability & focus (P1)
**Feedback**: `docs/tasks/feedbacks.md:13`  
**Observation**: The mobile web app allows the device to sleep; no Wake Lock or low-bandwidth adjustments are present.  
**Actions**:
- Integrate the Screen Wake Lock API (with fallbacks) to keep sessions active on mobile.
- Add connection status & bandwidth monitors so the agent can adapt question cadence when latency spikes.
- Audit touch targets and layout for one-handed use during 10–15 minute bursts.

### 8. Habit loops & asynchronous knowledge capture (P2)
**Feedback**: `docs/tasks/feedbacks.md:17`  
**Observation**: The product currently focuses on synchronous interviews only.  
**Actions**:
- Prototype a weekly “Highlight / Lowlight” micro-ritual: push a notification, collect voice or text snippets, auto-route to the knowledge base.
- Summarize weekly submissions into a manager digest and blend them into the coverage model (lower weight than interviews).
- Explore spaced repetition prompts to revisit stale topics when confidence decays.

### 9. Supporting research & enablers (P2)
- Survey recent Azure Speech + OpenAI hybrid architectures for bilingual accuracy improvements (target: new Azure neural STT releases in 2024/2025).
- Evaluate open-source graph visualization libraries (React Flow, d3-hierarchy) that can handle dynamic topic trees without blocking WebRTC performance.
- Instrument qualitative UX tests (5 person study) to validate the “current question” and “knowledge graph” concepts before full build.

## Execution Priorities
- **Now (P0 focus)**
  - Session pacing presets, countdown UI, autosave, and analytics instrumentation.
  - Transcript pipeline upgrade: Azure Speech spike, chunk merging, verification layers.
  - Interview prompt revisions, question visibility, and coverage calculation overhaul with traceable evidence.
- **Soon (P1 polish)**
  - Knowledge graph visualization and sidebar integration.
  - Dashboard/session summary enhancements plus final script deliverable.
  - Mobile wake lock, connection quality monitors, and responsive touch refinements.
- **Later (P2 experiments)**
  - Weekly highlight/lowlight ritual and asynchronous capture workflows.
  - Manager digest generation and spaced repetition nudges.
  - Research spikes (graph tech, UX validation studies) once core loops stabilize.

## P0 Success Metrics (Now Scope)
- **Session pacing & fatigue guardrails**: Timer options include 15-minute default, 30-minute deep dive, and opt-in no-limit mode; ≥95% of capped sessions auto-wrap within 60 seconds of the selected limit; autosave checkpoints occur at least every 90 seconds so that recovered transcripts lose ≤30 seconds of audio.
- **Transcript accuracy & readability**: Streaming STT switch delivers ≤0.25 word error rate on Japanese benchmark set (20% relative improvement vs. Whisper baseline); merged transcript bubbles reduce median message fragments per minute by ≥40%; ≥90% of transcript sentences reach “verified” status within 2 minutes of capture.
- **Coverage analytics & explainability**: Coverage percentages derive from knowledge atoms across all completed sessions with ≥1 evidence link per topic; discrepancy between displayed coverage and manual QA sampling stays within ±10 percentage points; every progress bar exposes a “Why this %?” tooltip listing matching targets and transcript spans.

## Immediate Next Steps
1. ✅ Align with product on the P0 scope (session pacing, transcripts, coverage) and lock success metrics.
2. ⬜️ Spike the Azure Speech streaming path behind a feature flag to compare accuracy vs. Whisper.
3. ⬜️ Draft revised interviewer instructions and run small-scale dry runs to ensure tone remains empathetic while cutting repetition.
4. ⬜️ Design wireframes for the knowledge graph sidebar + dashboard deliverables before engineering implementation.

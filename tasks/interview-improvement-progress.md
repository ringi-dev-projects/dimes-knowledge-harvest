# Interview Improvement Progress

Use this tracker to record status updates as we execute the roadmap. Align task names with `tasks/interview-improvement-plan.md` so we can reference and mark items complete with ✅.

## Upcoming Actions (P0 Execution Order)
1. ✅ Draft experiment plan for the Azure Speech streaming spike and schedule benchmark recordings (`tasks/azure-speech-spike-plan.md`).
2. ✅ Redline interviewer prompt revisions and spec the “current/next question” sidebar components (`tasks/interviewer-prompt-and-queue-notes.md`).
3. ✅ Design coverage evidence data model updates and tooltip UX (`tasks/coverage-evidence-design.md`).
4. ✅ Implement timer UI and autosave manager once designs were approved.

## Now — P0 Scope

### Session pacing & fatigue guardrails
- ✅ Define UX for 15/30 minute presets, optional no-limit toggle, and reminder timings (`tasks/session-pacing-autosave-notes.md`).
- ✅ Implement timer UI with countdown, reminders, and wrap-up flow.
- ✅ Add background checkpoint saves and resumable session workflow.
- ✅ Capture session length analytics (events dispatched via `fireAnalyticsEvent`).

### Transcript accuracy & readability upgrades
- [ ] Spike Azure Speech streaming integration behind feature flag; capture accuracy metrics vs. Whisper.
  - 📝 Experiment plan ready (`tasks/azure-speech-spike-plan.md`).
- [ ] Implement chunk merging / paragraph smoothing before storing messages.
- [ ] Add “draft vs. verified” transcript presentation with correction cues.
- [ ] Build reviewer tooling for mistranscription highlighting.

### Interviewer prompt design & coverage explainability
- [ ] Revise interviewer system prompt to reduce answer recitation and add confirmation heuristics.
  - 📝 Locale-aware prompt strategy drafted (`tasks/interviewer-prompt-and-queue-notes.md`).
- [ ] Surface current/next question queue in the interview UI.
  - 📝 UX & data flow captured (`tasks/interviewer-prompt-and-queue-notes.md`).
- [ ] Overhaul coverage calculation to aggregate all sessions, tie to knowledge atoms, and store trace evidence.
  - 📝 Data model & tooltip design drafted (`tasks/coverage-evidence-design.md`).
- [ ] Add “Why this %?” explainers referencing transcript spans.
  - 📝 Tooltip content & modal workflow defined (`tasks/coverage-evidence-design.md`).

## Soon — P1 Polish
- [ ] Knowledge graph visualization prototype and integration.
- [ ] Dashboard/session summary enhancements with final script view.
- [ ] Mobile wake lock & connection quality monitors.

## Later — P2 Experiments
- [ ] Weekly highlight/lowlight ritual concept validation.
- [ ] Manager digest automation & spaced repetition nudges.
- [ ] Graph visualization tech spike + UX testing study.

## Immediate Next Steps Alignment
- ✅ Align on Now-scope success metrics (P0).
- [ ] Confirm green light for Azure Speech spike.
- [ ] Approve revised interviewer prompt outline.
- [ ] Kick off design for knowledge graph sidebar & session summary surfaces.

# Coverage Evidence & Tooltip Design Notes

Purpose: overhaul coverage calculations so every percentage is grounded in knowledge atoms or Q&A evidence, and surface transparent “Why this %?” explanations in the dashboard and interview UI.

## Data Model Enhancements

### New Table: `coverage_evidence`
| Column | Type | Description |
| --- | --- | --- |
| `id` | serial PK | |
| `company_id` | int FK → companies.id | |
| `topic_id` | text | Matches topic tree node ID |
| `target_id` | text | Optional: specific target question identifier |
| `knowledge_atom_id` | int FK → knowledge_atoms.id (nullable) | Primary evidence source |
| `qa_turn_id` | int FK → qa_turns.id (nullable) | Supplemental evidence when knowledge atom is unavailable |
| `confidence` | real | Evidence confidence (0–1) |
| `evidence_type` | text enum (`knowledge_atom`, `qa_turn`, `manual_note`) |
| `excerpt` | text | Highlightable transcript span |
| `created_at` | timestamptz | |

### Coverage Scores Updates (`coverage_scores`)
- Add `evidence_count` (int) and `last_evidence_at` (timestamptz).
- Store `coverage_percent` explicitly instead of recomputing on the fly for auditing.

### API Adjustments
- `/api/coverage/calculate`:
  - Iterate over all relevant knowledge atoms for the company; map each to topic/target IDs.
  - Insert/update corresponding `coverage_evidence` rows.
  - Aggregate by topic to compute coverage percent = (# of targets satisfied) / (total targets).
  - Use weighting for corroboration: e.g., 1 knowledge atom = 0.6 coverage, corroborated by ≥2 sessions = 1.0.
- `/api/coverage` response:
  - Include `evidenceSummary` array with `evidenceId`, `sourceType`, `sourceSessionId`, `confidence`, `targetId`.

## Tooltip & UI Concepts

### Dashboard Progress Bars (`app/dashboard/page.tsx`)
- Add an info icon beside each progress bar percentage.
- Tooltip contents:
  - “Coverage: 67% (6/9 targets answered)”
  - “Evidence: [List of up to 3 bullet points]”
    - `• Procedure for Line A startup (Session #103, 0.92 confidence)`
    - Each bullet clickable → opens modal with transcript excerpt & knowledge atom content.
- Display “Last updated” timestamp and number of contributing sessions.
- If evidence is sparse (<2 items) show reminder banner: “Need more confirmation? Schedule follow-up.”

### Interview Sidebar (`app/interview/page.tsx`)
- For each topic, add a mini tooltip or expandable drawer showing:
  - Targets answered vs. remaining.
  - Recent evidence snippet (short excerpt) with a “Review in dashboard” link.
  - When coverage is updated, briefly highlight the new evidence entry.

### Evidence Modal
- Shared component accessible from dashboard & interview.
- Shows:
  - Knowledge atom title, type, confidence.
  - Transcript excerpt with highlighted sentences.
  - Buttons: “Mark as needs review”, “Jump to session transcript”.
  - If multiple evidence pieces exist, display tabbed list or timeline by session.

## Backend Logic Notes
- Build a `deriveEvidenceForTopic` helper that accepts knowledge atoms + target definitions and returns structured evidence (topic id, target id, atom id, confidence, excerpt).
- For QA turns without atoms, fallback to high-confidence answers (length, clarity heuristics).
- Introduce background job or post-interview trigger to recalc coverage; keep API idempotent.
- Add tests ensuring:
  - Multiple sessions aggregate correctly.
  - Evidence deletions (if session removed) update coverage.
  - Targets without evidence report 0 coverage.

## Instrumentation & QA
- Emit `coverage_evidence_added`, `coverage_evidence_reviewed`, and `coverage_tooltip_opened` events.
- Track discrepancy audits: sample topics weekly, compare manual QA to automated percent (should stay within ±10%).
- Provide admin endpoint `/api/admin/coverage-audit` returning raw evidence for inspection.

## Implementation Sequencing
1. Migrate database (add `coverage_evidence`, modify `coverage_scores`).
2. Update knowledge extraction pipeline to populate evidence entries.
3. Refactor coverage calculation endpoint and front-end data models.
4. Implement dashboard tooltip UI and modal.
5. Wire interview sidebar evidence drawer & update autosave payload with evidence references.
6. QA, telemetry checks, release toggled behind feature flag `ENABLE_EVIDENCE_TOOLTIP`.

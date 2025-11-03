-- Add autosave queue and feedback payloads
ALTER TABLE interview_autosaves
  ADD COLUMN queue_json text NOT NULL DEFAULT '{"current":null,"pending":[],"completed":[]}',
  ADD COLUMN feedback_json text NOT NULL DEFAULT '{}'::text;

ALTER TABLE interview_autosaves
  ALTER COLUMN queue_json DROP DEFAULT,
  ALTER COLUMN feedback_json DROP DEFAULT;

-- Extend coverage scores with percentage and evidence bookkeeping
ALTER TABLE coverage_scores
  ADD COLUMN coverage_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN evidence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_evidence_at timestamptz;

ALTER TABLE coverage_scores
  ALTER COLUMN coverage_percent DROP DEFAULT,
  ALTER COLUMN evidence_count DROP DEFAULT;

-- Coverage evidence table
CREATE TABLE IF NOT EXISTS coverage_evidence (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  target_id text,
  knowledge_atom_id integer REFERENCES knowledge_atoms(id) ON DELETE CASCADE,
  qa_turn_id integer REFERENCES qa_turns(id) ON DELETE CASCADE,
  confidence real DEFAULT 0,
  evidence_type text NOT NULL,
  excerpt text,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS coverage_evidence_company_topic_idx
  ON coverage_evidence (company_id, topic_id);

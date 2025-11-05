-- Extend interview autosaves with transcript draft/review payloads
ALTER TABLE interview_autosaves
  ADD COLUMN drafts_json text NOT NULL DEFAULT '[]',
  ADD COLUMN reviews_json text NOT NULL DEFAULT '[]';

ALTER TABLE interview_autosaves
  ALTER COLUMN drafts_json DROP DEFAULT,
  ALTER COLUMN reviews_json DROP DEFAULT;

-- CRM Leady — v3 migration: standalone notes (not tied to any lead)
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title      text        NOT NULL DEFAULT '',
  content    text        NOT NULL DEFAULT '',
  color      text        NOT NULL DEFAULT 'default'
                          CHECK (color IN ('default','yellow','blue','green','red','purple')),
  pinned     boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS notes_sort_idx
  ON notes (pinned DESC, updated_at DESC);

-- Reuse the bump-updated_at function from schema.sql if present, else create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

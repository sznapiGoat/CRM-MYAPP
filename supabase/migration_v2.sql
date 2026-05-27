-- CRM Leady — v2 migration
-- Run this in your Supabase SQL editor

-- 1. Follow-up date on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

-- 2. Activity log table
CREATE TABLE IF NOT EXISTS lead_activities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  lead_id    uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('called', 'note', 'status_change')),
  note       text,
  old_status text,
  new_status text
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx
  ON lead_activities (lead_id, created_at DESC);

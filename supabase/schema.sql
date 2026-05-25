-- CRM Leady — full schema
-- Run this in your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS leads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  nazev           text        NOT NULL,
  mesto           text        NOT NULL,
  telefon         text        NOT NULL,
  adresa          text        NOT NULL,
  web             text,
  google_maps_url text        NOT NULL,
  kategorie       text        NOT NULL,
  duvod           text        NOT NULL,
  status          text        NOT NULL DEFAULT 'novy'
                              CHECK (status IN ('novy','zavolano','zajem','demo_poslano','ceka','zavreno','nezajem')),
  poznamka        text,
  rating          numeric,
  last_called_at  timestamptz
);

-- Unique index for upsert deduplication by google_maps_url
CREATE UNIQUE INDEX IF NOT EXISTS leads_google_maps_url_idx ON leads (google_maps_url);

-- Function that bumps updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger wired to the function
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

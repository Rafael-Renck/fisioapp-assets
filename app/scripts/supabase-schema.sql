-- Este esquema não é exposto pela API pública do Supabase.
CREATE SCHEMA IF NOT EXISTS fisioapp;
REVOKE ALL ON SCHEMA fisioapp FROM PUBLIC;

CREATE TABLE IF NOT EXISTS fisioapp.documents (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fisioapp.login_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL,
  window_start bigint NOT NULL
);

REVOKE ALL ON ALL TABLES IN SCHEMA fisioapp FROM PUBLIC;

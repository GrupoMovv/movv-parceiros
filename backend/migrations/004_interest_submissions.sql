-- Manifestações de Interesse — Movv Office e Movv Cobrancas
-- Execute: psql $DATABASE_URL -f migrations/004_interest_submissions.sql

CREATE TABLE IF NOT EXISTS interest_submissions (
  id           SERIAL PRIMARY KEY,
  partner_id   INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service      VARCHAR(20) NOT NULL CHECK (service IN ('office', 'collections')),
  status       VARCHAR(20) NOT NULL DEFAULT 'novo'
                 CHECK (status IN ('novo', 'contactado', 'em_conversa', 'convertido', 'descartado')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  notes        TEXT,
  UNIQUE (partner_id, service)
);

CREATE INDEX IF NOT EXISTS idx_interest_partner ON interest_submissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_interest_status  ON interest_submissions(status);

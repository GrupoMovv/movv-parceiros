-- Disk Bebidas: moderação inteligente (Junior, 29/09/2026). O produto
-- passa por checks automáticos; parceiro CONFIÁVEL (5+ aprovados, sem
-- rejeição em 30 dias, CNAE compatível) com todos os checks OK publica
-- direto; o resto vai pra fila já com o motivo. 1 em 10 dos publicados
-- direto cai numa aba "Conferir" (auditoria por amostra, já no ar).
-- Idempotente (o Build Command roda npm run migrate a cada deploy).
-- Execute: node migrations/run.js

ALTER TABLE beer_produtos
  -- [{ check, ok, motivo }] da última avaliação (a fila mostra isso)
  ADD COLUMN IF NOT EXISTS moderacao_checks   JSONB,
  -- 'manual' (admin aprovou) | 'automatica' (publicou direto)
  ADD COLUMN IF NOT EXISTS moderacao_origem   VARCHAR(12),
  ADD COLUMN IF NOT EXISTS auditoria_pendente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auditado_em        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_beer_produtos_auditoria ON beer_produtos(updated_at) WHERE auditoria_pendente = true;

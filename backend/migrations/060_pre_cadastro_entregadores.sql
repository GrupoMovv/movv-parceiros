-- IUB+ ENTREGADORES: pré-cadastro de motoboys (/entregadores, "em breve").
-- Só lista de espera — não é conta, não tem login nem vínculo com parceiro.
-- Execute: node migrations/run.js (aditivo e idempotente).
--
-- ROLLBACK (manual — run.js não tem "down"):
--   DROP TABLE IF EXISTS pre_cadastro_entregadores;

-- UUID de propósito (resto do banco é SERIAL): o id aparece na URL do PATCH
-- do admin e não deve deixar contar quantos se cadastraram.
-- gen_random_uuid() é nativo desde o PG 13 (produção roda 18).
CREATE TABLE IF NOT EXISTS pre_cadastro_entregadores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255) NOT NULL,
  whatsapp      VARCHAR(20) NOT NULL,       -- só dígitos com DDD, ex.: 64999998888
  tem_moto      BOOLEAN DEFAULT true,
  bairros       JSONB DEFAULT '[]',         -- ["Centro", "Planalto"]
  -- novo | contatado | aprovado | descartado (ver entregadoresController)
  status        VARCHAR(20) DEFAULT 'novo',
  ip_cadastro   VARCHAR(50),
  user_agent    TEXT,
  criado_em     TIMESTAMP DEFAULT NOW(),
  contatado_em  TIMESTAMP,
  observacoes   TEXT
);

CREATE INDEX IF NOT EXISTS idx_pre_cadastro_status ON pre_cadastro_entregadores(status);
CREATE INDEX IF NOT EXISTS idx_pre_cadastro_whatsapp ON pre_cadastro_entregadores(whatsapp);

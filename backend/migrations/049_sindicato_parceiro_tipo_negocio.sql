-- Separa PRODUTO de SERVICO nos parceiros do marketplace -- ver
-- /marketplace/servicos e /servicos/:slug (frontend). Parceiro pode ser
-- so produto, so servico, ou hibrido (aparece nas duas listagens).
-- Execute: node migrations/run.js

-- CREATE TYPE nao aceita IF NOT EXISTS no Postgres -- migrations/run.js
-- reroda TODOS os arquivos toda vez (sem tabela de controle), entao sem
-- esse DO block a 2a execucao quebraria com "type already exists".
DO $$ BEGIN
  CREATE TYPE tipo_negocio_enum AS ENUM ('produto', 'servico', 'hibrido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS tipo_negocio tipo_negocio_enum NOT NULL DEFAULT 'produto';

-- Campos extras SO fazem sentido pra quem presta servico -- ficam NULL
-- pra quem e so produto (checagem em app, nao aqui, de propósito: nao
-- vale a pena travar isso com CHECK e arriscar quebrar import futuro).
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS preco_medio         VARCHAR(50),  -- "R$ 150", "R$ 100-200"
  ADD COLUMN IF NOT EXISTS duracao_media       VARCHAR(50),  -- "50 minutos", "1 hora"
  ADD COLUMN IF NOT EXISTS modalidades         TEXT,         -- "Presencial, Online"
  ADD COLUMN IF NOT EXISTS horario_atendimento TEXT;         -- "Seg-Sex 8h-18h"

-- (Removido em 25/09/2026) Aqui havia 11 UPDATEs fixando tipo_negocio de
-- parceiros por slug — dado de uma vez só, já aplicado em produção. Com o
-- `npm run migrate` rodando a CADA deploy (Build Command do Render), eles
-- sobrescreveriam o que o parceiro escolheu no painel. Numa base nova esses
-- slugs nem existem (parceiro é dado de produção, não seed).

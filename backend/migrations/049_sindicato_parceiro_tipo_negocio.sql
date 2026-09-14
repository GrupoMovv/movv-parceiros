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

-- Categorizacao dos 11 parceiros ja migrados (ver conversa/TODO.md sobre
-- o bootstrap da Roleta pra contexto de quem sao). Quem nao esta nessa
-- lista (parceiros futuros) fica no DEFAULT 'produto' ate alguem ajustar
-- pelo painel -- sistema nao quebra, so decide errado até corrigirem.
UPDATE sindicato_parceiros SET tipo_negocio = 'produto' WHERE slug = 'nossa-drogaria';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'academia-atletica';
UPDATE sindicato_parceiros SET tipo_negocio = 'hibrido' WHERE slug = 'diroma-fiori';
UPDATE sindicato_parceiros SET tipo_negocio = 'produto' WHERE slug = 'oticas-diniz';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'ezequiel-nutricionista';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'plenitude-psicologia';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'nesplora-neuropsicologia';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'laura-clemente-estetica';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'studio-vip';
UPDATE sindicato_parceiros SET tipo_negocio = 'produto' WHERE slug = 'imaginari-personalizados';
UPDATE sindicato_parceiros SET tipo_negocio = 'servico' WHERE slug = 'azul-emprestimo';

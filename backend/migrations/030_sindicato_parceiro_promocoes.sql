-- Bloco 10 do IUB MAIS: sistema de promocoes de verdade. A tabela
-- sindicato_parceiro_promocoes ja existia (Bloco 1, vazia ate agora) so
-- com id/parceiro_id/titulo/descricao/valido_ate/ativo/created_at -
-- completa aqui com tudo que o parceiro preenche no formulario.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiro_promocoes
  ALTER COLUMN titulo TYPE VARCHAR(200),
  ADD COLUMN IF NOT EXISTS produto_id          INTEGER REFERENCES sindicato_parceiro_produtos(id) ON DELETE SET NULL,
  -- se produto_id preenchido e foto_url vazio, a home/pagina publica usa a
  -- foto principal do produto (ver query em marketplaceHomeController).
  ADD COLUMN IF NOT EXISTS foto_url             VARCHAR(500),
  ADD COLUMN IF NOT EXISTS foto_public_id       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS categoria            VARCHAR(60),
  ADD COLUMN IF NOT EXISTS preco_de             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preco_por            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preco_associado      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS data_inicio          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fim             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destaque             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusivo_associado  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limite_usos          INTEGER,
  ADD COLUMN IF NOT EXISTS usos_atuais          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rascunho             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_promocoes_vigencia
  ON sindicato_parceiro_promocoes(ativo, rascunho, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_promocoes_produto
  ON sindicato_parceiro_promocoes(produto_id);

-- Plano do parceiro (Bloco 10: limite de promocoes ativas por plano). Todo
-- mundo comeca no gratis - upgrade e feito manualmente por enquanto, nao
-- ha tela de cobranca ainda.
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS plano VARCHAR(20) NOT NULL DEFAULT 'gratis';

-- Cliques/visualizacoes tambem passam a poder apontar pra uma promocao
-- (alem de produto, ja existente desde o Bloco 6) - mesma tabela, mesmo
-- padrao de analytics.
ALTER TABLE sindicato_parceiro_cliques
  ADD COLUMN IF NOT EXISTS promocao_id INTEGER REFERENCES sindicato_parceiro_promocoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_cliques_promocao ON sindicato_parceiro_cliques(promocao_id, tipo);

-- Bloco 6: a pagina publica do produto precisa saber QUAL produto foi
-- visto/gerou clique no WhatsApp (nao so o parceiro), e se foi um
-- associado (via hash da carteirinha) que fez a acao.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiro_cliques
  ADD COLUMN IF NOT EXISTS produto_id   INTEGER REFERENCES sindicato_parceiro_produtos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS associado_id INTEGER REFERENCES sindicato_associados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_cliques_produto ON sindicato_parceiro_cliques(produto_id, tipo);

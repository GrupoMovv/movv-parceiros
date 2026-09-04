-- Carrinho/lista de interesses do Marketplace — só pra associados logados
-- (visitante sem sessão usa localStorage no front, nunca toca essa tabela).
-- Não é carrinho de compra de verdade (não processa pagamento nem
-- estoque): é só "produtos que eu quero conversar com o parceiro depois",
-- por isso não tem quantidade/preço travado, só a observação livre.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_associado_carrinho (
  id             SERIAL PRIMARY KEY,
  associado_id   INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  produto_id     INTEGER NOT NULL REFERENCES sindicato_parceiro_produtos(id) ON DELETE CASCADE,
  observacoes    VARCHAR(255),
  adicionado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (associado_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_associado_carrinho_associado ON sindicato_associado_carrinho(associado_id);

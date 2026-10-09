-- Quem alterou a chave PIX de um parceiro e quando (Junior, 09/10/2026).
-- Em Pagamentos, chave trocada nos últimos 7 dias mostra um aviso antes do
-- "Registrar PIX". Grava o valor de antes e o de depois; quem alterou pode
-- ser admin, financeiro ou a contabilidade (funcionário dela).
CREATE TABLE IF NOT EXISTS partner_pix_historico (
  id                SERIAL PRIMARY KEY,
  partner_id        INTEGER      NOT NULL REFERENCES partners(id),
  campo             VARCHAR(40)  NOT NULL DEFAULT 'pix_key',
  valor_antes       TEXT,
  valor_depois      TEXT,
  alterado_por_id   INTEGER,
  alterado_por_nome VARCHAR(300),
  criado_em         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_pix_historico ON partner_pix_historico (partner_id, criado_em DESC);

-- Ação em lote no registro de quem fez (ex.: "Expirar pendentes", que pode
-- não expirar nenhuma indicação): uma linha sem alvo, com a quantidade nos
-- detalhes.
ALTER TABLE admin_acoes ALTER COLUMN alvo_id DROP NOT NULL;

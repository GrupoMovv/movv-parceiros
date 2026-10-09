-- Registro de quem fez cada ação de dinheiro no portal (Junior, 09/10/2026):
-- aprovar, cancelar e voltar comissão, e marcar pagamento — nas comissões dos
-- parceiros, nas comissões internas e nas dos indicadores. Com mais de um
-- admin (ADMIN-002), precisa saber quem fez o quê. Vale daqui em diante; o
-- que já foi feito antes não tem autor.
-- admin_nome guarda o nome e o código na hora da ação (a conta pode mudar ou
-- ser desativada depois).
CREATE TABLE IF NOT EXISTS admin_acoes (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER,                      -- partners.id (sem FK: o histórico fica)
  admin_nome  VARCHAR(300) NOT NULL,
  acao        VARCHAR(40)  NOT NULL,
  alvo_tipo   VARCHAR(40)  NOT NULL,        -- commissions, payments, internal_commissions, indicator_referrals, indicator_payments
  alvo_id     INTEGER      NOT NULL,
  detalhes    JSONB,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_acoes_alvo ON admin_acoes (alvo_tipo, alvo_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_admin_acoes_admin ON admin_acoes (admin_id, criado_em DESC);

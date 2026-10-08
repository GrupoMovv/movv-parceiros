-- Clube MAIS+: lista de interessados na assinatura de R$ 9,90 ("Quero ser
-- avisado" na página /clube e no "Quero entrar no Clube" do produto).
-- Decisão do Junior (07/10, item 18): nome, WhatsApp e autorização para
-- contato. Um registro por WhatsApp (pedir de novo só atualiza).
CREATE TABLE IF NOT EXISTS clube_interessados (
  id              SERIAL PRIMARY KEY,
  nome            VARCHAR(120) NOT NULL,
  whatsapp        VARCHAR(20)  NOT NULL UNIQUE,      -- só dígitos, com DDD
  autorizou_contato BOOLEAN    NOT NULL,
  associado_id    INTEGER REFERENCES sindicato_associados(id) ON DELETE SET NULL, -- se estava logado
  origem          VARCHAR(30),                       -- 'pagina_clube' | 'produto' ...
  ip              VARCHAR(64),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

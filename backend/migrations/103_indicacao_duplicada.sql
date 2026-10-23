-- Indicação duplicada (Junior, 23/10/2026). Mesmo cliente (CPF/CNPJ) +
-- mesmo produto: ganha quem indicou primeiro, e a indicação fica protegida
-- por 30 dias, ou enquanto houver contrato, lançamento não estornado ou
-- venda convertida. A regra fica em src/services/indicacaoDuplicada.js.
--   client_documento  CPF (11) ou CNPJ (14) do cliente, só dígitos. O
--                     client_cpf continua sendo gravado quando é CPF (a
--                     importação da Azul casa por ele).
--   referral_tentativas_bloqueadas  tentativa de Partner barrada. Nunca
--                     guarda o documento inteiro: só mascarado + HMAC.
-- Idempotente. Não mexe em comissão, regra, fechamento nem lançamento.
-- Execute: node migrations/run.js

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS client_documento VARCHAR(14)
    CHECK (client_documento ~ '^([0-9]{11}|[0-9]{14})$');

-- Indicações antigas: copia o CPF que já existe (só os que têm 11 dígitos;
-- o client_cpf sempre foi validado no cadastro). Não sobrescreve nada.
UPDATE referrals SET client_documento = client_cpf
 WHERE client_documento IS NULL AND client_cpf ~ '^[0-9]{11}$';

CREATE INDEX IF NOT EXISTS idx_referrals_documento_produto
  ON referrals (client_documento, product_id, created_at)
  WHERE client_documento IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_tentativas_bloqueadas (
  id                      SERIAL PRIMARY KEY,
  partner_id              INTEGER      NOT NULL REFERENCES partners(id),
  product_id              INTEGER      NOT NULL REFERENCES products(id),
  documento_mascarado     VARCHAR(20)  NOT NULL,
  documento_hash          CHAR(64)     NOT NULL,           -- HMAC-SHA256, nunca o documento
  motivo                  VARCHAR(20)  NOT NULL CHECK (motivo IN ('duplicidade', 'limite')),
  referral_bloqueadora_id INTEGER      REFERENCES referrals(id),
  criado_em               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  liberada_em             TIMESTAMPTZ,
  liberada_por            VARCHAR(300),
  motivo_liberacao        TEXT,
  usada_em                TIMESTAMPTZ,                     -- quando a liberação deixou a indicação passar
  referral_liberada_id    INTEGER      REFERENCES referrals(id)
);
CREATE INDEX IF NOT EXISTS idx_tentativas_partner_data
  ON referral_tentativas_bloqueadas (partner_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tentativas_liberadas_abertas
  ON referral_tentativas_bloqueadas (partner_id, product_id, documento_hash)
  WHERE liberada_em IS NOT NULL AND usada_em IS NULL;

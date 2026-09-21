-- Assinatura automática dos planos do parceiro via Mercado Pago (PIX mensal
-- e cartão recorrente, trial de 7 dias) — ver config/mercadopago.js e
-- config/planos.js (precoAssinatura). Execute: node migrations/run.js
--
-- O plano que vale pro parceiro continua sendo sindicato_parceiros.plano
-- (é o que planoEfetivo() lê em todo lugar). Estas tabelas guardam o
-- CONTRATO com o MP e os pagamentos; quem muda o plano do parceiro é a
-- lógica de assinatura (webhook/criação), igual o admin já faz em
-- sindicatoPlanosController.alterarPlano. Parceiro sem assinatura
-- nenhuma segue exatamente como hoje (grátis, ou plano trocado à mão).

CREATE TABLE IF NOT EXISTS sindicato_assinaturas (
  id                      SERIAL PRIMARY KEY,
  parceiro_id             INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  plano_nome              VARCHAR(20) NOT NULL CHECK (plano_nome IN ('oficial', 'premium', 'master')),
  metodo_pagamento        VARCHAR(20) NOT NULL CHECK (metodo_pagamento IN ('pix', 'cartao_recorrente')),
  -- Snapshot do preço no momento da assinatura (mesmo raciocínio da
  -- migration 041): se a empresa deixar de estar em dia com o sindicato,
  -- o valor já contratado não muda sozinho.
  valor_mensal            NUMERIC(10,2) NOT NULL CHECK (valor_mensal > 0),
  era_sindicalizada       BOOLEAN,
  status                  VARCHAR(20) NOT NULL DEFAULT 'trial'
                            CHECK (status IN ('trial', 'ativa', 'pausada', 'cancelada', 'vencida')),
  trial_ate               TIMESTAMPTZ,
  data_inicio             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_proxima_cobranca   TIMESTAMPTZ,
  -- Cancelou: o plano continua valendo até o fim do período já pago
  -- (acesso_ate); depois volta pro Grátis.
  data_cancelamento       TIMESTAMPTZ,
  acesso_ate              TIMESTAMPTZ,
  mp_subscription_id      VARCHAR(80),   -- cartão recorrente (preapproval)
  mp_customer_id          VARCHAR(80),
  mp_payer_email          VARCHAR(255),  -- o MP exige e-mail do pagador na assinatura
  -- test/prod: um registro criado com credencial de teste nunca pode ser
  -- confundido com cobrança real (nem consultado com token de produção).
  ambiente                VARCHAR(4) NOT NULL CHECK (ambiente IN ('test', 'prod')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No máximo UMA assinatura "viva" por parceiro — segura clique duplo /
-- duas abas assinando ao mesmo tempo no nível do banco, não só no código.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assinatura_viva_por_parceiro
  ON sindicato_assinaturas(parceiro_id) WHERE status IN ('trial', 'ativa', 'pausada');
CREATE UNIQUE INDEX IF NOT EXISTS uq_assinatura_mp_subscription
  ON sindicato_assinaturas(mp_subscription_id) WHERE mp_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assinatura_parceiro ON sindicato_assinaturas(parceiro_id, created_at DESC);
-- Varredura de "trial acabando / cobrança chegando / acesso expirou".
CREATE INDEX IF NOT EXISTS idx_assinatura_status_datas ON sindicato_assinaturas(status, trial_ate, data_proxima_cobranca);

CREATE TABLE IF NOT EXISTS sindicato_pagamentos (
  id                SERIAL PRIMARY KEY,
  assinatura_id     INTEGER NOT NULL REFERENCES sindicato_assinaturas(id) ON DELETE CASCADE,
  valor             NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  metodo            VARCHAR(10) NOT NULL CHECK (metodo IN ('pix', 'cartao')),
  status            VARCHAR(15) NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'reembolsado', 'cancelado', 'expirado')),
  status_detalhe    VARCHAR(80),   -- status_detail do MP (ex.: cc_rejected_insufficient_amount)
  mp_payment_id     VARCHAR(80),
  -- PIX: QR guardado pra reexibir enquanto não vence (fechou o modal e
  -- voltou) sem gerar outra cobrança.
  pix_qr_code       TEXT,
  pix_qr_code_base64 TEXT,
  pix_expira_em     TIMESTAMPTZ,
  data_pagamento    TIMESTAMPTZ,
  data_vencimento   TIMESTAMPTZ,
  -- Período de acesso que este pagamento compra (renovação mensal).
  periodo_inicio    TIMESTAMPTZ,
  periodo_fim       TIMESTAMPTZ,
  ambiente          VARCHAR(4) NOT NULL CHECK (ambiente IN ('test', 'prod')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotência: o mesmo pagamento do MP (webhook repetido, retry) nunca
-- vira duas linhas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamento_mp_payment
  ON sindicato_pagamentos(mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamento_assinatura ON sindicato_pagamentos(assinatura_id, created_at DESC);

-- Log de TODA notificação recebida do MP (válida ou não) — auditoria e
-- idempotência. O MP reenvia a mesma notificação até receber 200; o
-- processamento em si é idempotente (sempre reconsulta o recurso no MP e
-- faz upsert), este log serve pra saber o que chegou e o que deu erro.
CREATE TABLE IF NOT EXISTS sindicato_mp_eventos (
  id                SERIAL PRIMARY KEY,
  ambiente          VARCHAR(4) NOT NULL CHECK (ambiente IN ('test', 'prod')),
  tipo              VARCHAR(60),   -- "payment", "subscription_preapproval", ...
  acao              VARCHAR(60),   -- "payment.created", "updated", ...
  recurso_id        VARCHAR(80),   -- data.id
  notificacao_id    VARCHAR(80),   -- id da notificação (se o MP mandar)
  x_request_id      VARCHAR(120),
  assinatura_valida BOOLEAN NOT NULL,
  payload           JSONB,
  resultado         VARCHAR(40),   -- processado | ignorado | erro | assinatura_invalida
  erro              TEXT,
  recebido_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mp_eventos_recurso ON sindicato_mp_eventos(tipo, recurso_id);
CREATE INDEX IF NOT EXISTS idx_mp_eventos_recebido ON sindicato_mp_eventos(recebido_em DESC);

-- Histórico de plano (migration 035) ganha os motivos da assinatura
-- automática. CHECK antigo foi criado sem nome explícito — acha pelo
-- conteúdo e recria (DO block: migrations/run.js reroda tudo sempre).
DO $$
DECLARE nome_check TEXT;
BEGIN
  SELECT conname INTO nome_check FROM pg_constraint
   WHERE conrelid = 'sindicato_plano_historico'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%motivo%';
  IF nome_check IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sindicato_plano_historico DROP CONSTRAINT %I', nome_check);
  END IF;
  ALTER TABLE sindicato_plano_historico ADD CONSTRAINT sindicato_plano_historico_motivo_check
    CHECK (motivo IN ('upgrade', 'downgrade', 'cancelamento', 'ativacao_seed', 'suspensao', 'reativacao',
                      'assinatura_trial', 'assinatura_ativa', 'assinatura_encerrada'));
END $$;

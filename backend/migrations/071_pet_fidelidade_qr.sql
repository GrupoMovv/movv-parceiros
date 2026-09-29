-- Pet parte 5: atendimento registrado por QR (nos dois sentidos) e cartão
-- fidelidade por pet, definido pelo pet shop. Idempotente (o Build Command
-- roda npm run migrate a cada deploy).
-- Execute: node migrations/run.js

-- Token do QR: o do PET (cliente mostra, pet shop lê) e o do PET SHOP
-- (fica no balcão, cliente lê). Gerados pela aplicação na 1ª vez que o QR
-- é pedido (não dá pra ter DEFAULT aleatório sem extensão).
ALTER TABLE pets                ADD COLUMN IF NOT EXISTS qr_token VARCHAR(40);
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS pet_qr_token VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_qr_token ON pets(qr_token) WHERE qr_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_parceiros_pet_qr_token ON sindicato_parceiros(pet_qr_token) WHERE pet_qr_token IS NOT NULL;

-- Atendimento REALIZADO. origem:
--   loja_leu     -> pet shop leu o QR do pet (ou tocou "Marcar como realizado"): vale na hora;
--                   o dono pode contestar ("não fui eu")
--   cliente_leu  -> cliente leu o QR do balcão: fica aguardando_loja até o pet shop confirmar
-- status: confirmado | aguardando_loja | contestado | recusado
CREATE TABLE IF NOT EXISTS pet_atendimentos (
  id              SERIAL PRIMARY KEY,
  pet_id          INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  parceiro_id     INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  associado_id    INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  servico         VARCHAR(30) NOT NULL,
  dia             DATE NOT NULL,                 -- em Itumbiara
  origem          VARCHAR(12) NOT NULL CHECK (origem IN ('loja_leu', 'cliente_leu')),
  status          VARCHAR(16) NOT NULL CHECK (status IN ('confirmado', 'aguardando_loja', 'contestado', 'recusado')),
  agendamento_id  INTEGER REFERENCES pet_agendamentos(id) ON DELETE SET NULL,
  confirmado_em   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 1 atendimento valendo por pet/dia/pet shop (contestado/recusado liberam de novo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_atendimento_dia ON pet_atendimentos(pet_id, parceiro_id, dia)
  WHERE status IN ('confirmado', 'aguardando_loja');
CREATE INDEX IF NOT EXISTS idx_pet_atendimentos_parceiro ON pet_atendimentos(parceiro_id, status, created_at DESC);

-- Cartão do pet shop: servico NULL = cartão geral (vale pra qualquer serviço
-- sem cartão próprio). Um por serviço.
CREATE TABLE IF NOT EXISTS pet_fidelidade_cartoes (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  servico      VARCHAR(30),
  meta         SMALLINT NOT NULL CHECK (meta BETWEEN 2 AND 30),
  premio       VARCHAR(120) NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_fidelidade_cartao ON pet_fidelidade_cartoes(parceiro_id, COALESCE(servico, '*'));

-- Prêmio conquistado (cartão completo). Vale 90 dias; o pet shop resgata.
-- premio_texto/meta: foto do cartão no momento (o pet shop pode mudar depois).
CREATE TABLE IF NOT EXISTS pet_fidelidade_premios (
  id             SERIAL PRIMARY KEY,
  cartao_id      INTEGER NOT NULL REFERENCES pet_fidelidade_cartoes(id) ON DELETE CASCADE,
  pet_id         INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  premio_texto   VARCHAR(120) NOT NULL,
  disponivel_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em      TIMESTAMPTZ NOT NULL,
  resgatado_em   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pet_fidelidade_premios_pet ON pet_fidelidade_premios(pet_id);

-- Carimbo = atendimento confirmado que caiu num cartão. premio_id preenchido
-- = já foi usado pra fechar um cartão (ciclo encerrado).
CREATE TABLE IF NOT EXISTS pet_fidelidade_carimbos (
  id              SERIAL PRIMARY KEY,
  cartao_id       INTEGER NOT NULL REFERENCES pet_fidelidade_cartoes(id) ON DELETE CASCADE,
  pet_id          INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  atendimento_id  INTEGER NOT NULL UNIQUE REFERENCES pet_atendimentos(id) ON DELETE CASCADE,
  premio_id       INTEGER REFERENCES pet_fidelidade_premios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_fidelidade_carimbos_aberto ON pet_fidelidade_carimbos(cartao_id, pet_id) WHERE premio_id IS NULL;

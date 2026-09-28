-- Pet parte 3: ficha do pet (é do CLIENTE — conta do /meu), autorização
-- por pet shop (LGPD: o pet shop só vê a ficha se o dono deixou) e pedido de
-- horário (sem grade: cliente pede dia + período, pet shop confirma ou
-- propõe outro). Só tabelas novas. Idempotente (o Build Command roda
-- npm run migrate a cada deploy).
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS pets (
  id                     SERIAL PRIMARY KEY,
  associado_id           INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  -- básico
  nome                   VARCHAR(60) NOT NULL,
  especie                VARCHAR(10) NOT NULL CHECK (especie IN ('cao', 'gato', 'outro')),
  raca                   VARCHAR(40),            -- código de config/pet.js RACAS_PET, 'srd' ou NULL
  raca_outra             VARCHAR(60),            -- texto livre quando a raça não está na lista
  porte                  VARCHAR(20),            -- código de PORTES_PET (define o preço da tabela)
  sexo                   VARCHAR(6) CHECK (sexo IN ('macho', 'femea')),
  nascimento             DATE,
  nascimento_aproximado  BOOLEAN NOT NULL DEFAULT false,
  foto_url               VARCHAR(500),
  foto_public_id         VARCHAR(300),
  -- saúde
  castrado               BOOLEAN,                -- NULL = não informado
  alergias               TEXT,
  medicamentos           TEXT,
  comportamento          TEXT,                   -- "morde", "medo de secador"...
  -- contato de emergência
  vet_nome               VARCHAR(100),
  vet_telefone           VARCHAR(20),
  contato_extra_nome     VARCHAR(100),
  contato_extra_telefone VARCHAR(20),
  ativo                  BOOLEAN NOT NULL DEFAULT true,  -- "excluir" = desativar (histórico de pedidos fica)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pets_associado ON pets(associado_id) WHERE ativo = true;

-- Registro do dono, sem lembrete automático (não há cron).
CREATE TABLE IF NOT EXISTS pet_vacinas (
  id            SERIAL PRIMARY KEY,
  pet_id        INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  nome          VARCHAR(80) NOT NULL,
  data          DATE,
  proxima_dose  DATE
);
CREATE INDEX IF NOT EXISTS idx_pet_vacinas_pet ON pet_vacinas(pet_id);

-- Linha existe + revogado_em NULL = pet shop pode ver a ficha completa.
-- Revogar só marca a data (fica o registro de que houve consentimento).
CREATE TABLE IF NOT EXISTS pet_autorizacoes (
  pet_id         INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  parceiro_id    INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  autorizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revogado_em    TIMESTAMPTZ,
  PRIMARY KEY (pet_id, parceiro_id)
);
CREATE INDEX IF NOT EXISTS idx_pet_autorizacoes_parceiro ON pet_autorizacoes(parceiro_id) WHERE revogado_em IS NULL;

-- Pedido de horário. status:
--   pendente   -> cliente pediu, pet shop ainda não respondeu
--   proposta   -> pet shop sugeriu outro dia/período (proposta_*); cliente aceita ou cancela
--   confirmado -> combinado (pelo pet shop, ou cliente aceitou a proposta)
--   recusado   -> pet shop não pode atender
--   cancelado  -> cliente desistiu
-- pet_nome/pet_resumo: foto do básico no momento do pedido — o pet shop vê
-- isso mesmo SEM autorização da ficha (é o mínimo pra atender).
CREATE TABLE IF NOT EXISTS pet_agendamentos (
  id                SERIAL PRIMARY KEY,
  pet_id            INTEGER REFERENCES pets(id) ON DELETE SET NULL,
  associado_id      INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  parceiro_id       INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  servico           VARCHAR(30) NOT NULL,        -- código SERVICOS_PET
  porte             VARCHAR(20),
  pet_nome          VARCHAR(60) NOT NULL,
  pet_resumo        VARCHAR(160),                -- "Cão · Poodle · Pequeno · Fêmea"
  data              DATE NOT NULL,
  periodo           VARCHAR(10) NOT NULL CHECK (periodo IN ('manha', 'tarde', 'noite')),
  observacao        VARCHAR(500),
  preco_estimado    DECIMAL(10,2),               -- da tabela da Parte 2 na hora do pedido
  status            VARCHAR(12) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'proposta', 'confirmado', 'recusado', 'cancelado')),
  proposta_data     DATE,
  proposta_periodo  VARCHAR(10) CHECK (proposta_periodo IN ('manha', 'tarde', 'noite')),
  resposta          VARCHAR(500),                -- recado do pet shop ao responder
  respondido_em     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_agendamentos_parceiro ON pet_agendamentos(parceiro_id, status, data);
CREATE INDEX IF NOT EXISTS idx_pet_agendamentos_associado ON pet_agendamentos(associado_id, created_at DESC);

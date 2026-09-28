-- Pet parte 4: fotos antes/depois do atendimento (o pet shop envia) e
-- avaliação do pet shop por quem foi atendido. Idempotente (o Build
-- Command roda npm run migrate a cada deploy).
-- Execute: node migrations/run.js

-- Consentimento do DONO pra foto do atendimento ir pra galeria pública do
-- pet shop. NULL = ainda não respondeu (conta como não).
ALTER TABLE pet_agendamentos ADD COLUMN IF NOT EXISTS fotos_publicas BOOLEAN;

CREATE TABLE IF NOT EXISTS pet_atendimento_fotos (
  id              SERIAL PRIMARY KEY,
  agendamento_id  INTEGER NOT NULL REFERENCES pet_agendamentos(id) ON DELETE CASCADE,
  tipo            VARCHAR(6) NOT NULL CHECK (tipo IN ('antes', 'depois')),
  url             VARCHAR(500) NOT NULL,
  public_id       VARCHAR(300),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_atendimento_fotos_ag ON pet_atendimento_fotos(agendamento_id);

-- Uma avaliação por atendimento (UNIQUE), só de atendimento confirmado cujo
-- dia já passou (regra no controller). oculta = admin escondeu o
-- COMENTÁRIO (ofensivo); a nota continua contando na média.
CREATE TABLE IF NOT EXISTS pet_avaliacoes (
  id              SERIAL PRIMARY KEY,
  agendamento_id  INTEGER NOT NULL UNIQUE REFERENCES pet_agendamentos(id) ON DELETE CASCADE,
  parceiro_id     INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  associado_id    INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  nota            SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario      VARCHAR(600),
  resposta        VARCHAR(600),                 -- do pet shop, pública
  respondido_em   TIMESTAMPTZ,
  oculta          BOOLEAN NOT NULL DEFAULT false,
  oculta_por      VARCHAR(120),                 -- e-mail do admin
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pet_avaliacoes_parceiro ON pet_avaliacoes(parceiro_id, created_at DESC);

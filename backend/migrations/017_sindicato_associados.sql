-- Portal de Associados do Sindicato (Renan): base de associados importada do
-- Higestor (sistema externo do sindicato), com dependentes e edição manual
-- de WhatsApp / dados cadastrais pelo Renan.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_associados (
  id                    SERIAL PRIMARY KEY,
  external_id           VARCHAR(50) NOT NULL UNIQUE,
  nome_completo         VARCHAR(255) NOT NULL,
  cpf                   VARCHAR(14) NOT NULL UNIQUE,
  data_nascimento       DATE,
  sexo                  VARCHAR(1) CHECK (sexo IS NULL OR sexo IN ('F', 'M', 'P')),
  categoria_profissional VARCHAR(50),
  codigo_filiado        VARCHAR(50),
  celular               VARCHAR(20),
  whatsapp              VARCHAR(20),
  email                 VARCHAR(255),
  cidade                VARCHAR(120),
  estado                VARCHAR(2),
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes           TEXT,
  cadastrado_por_id     INTEGER REFERENCES internal_collaborators(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_associados_dependentes (
  id            SERIAL PRIMARY KEY,
  associado_id  INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  nome          VARCHAR(255) NOT NULL,
  ordem         SMALLINT NOT NULL CHECK (ordem BETWEEN 1 AND 6),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (associado_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_sindicato_associados_ativo         ON sindicato_associados(ativo);
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_nome          ON sindicato_associados(nome_completo);
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_sem_whatsapp  ON sindicato_associados(id) WHERE whatsapp IS NULL;
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_dep_associado ON sindicato_associados_dependentes(associado_id);

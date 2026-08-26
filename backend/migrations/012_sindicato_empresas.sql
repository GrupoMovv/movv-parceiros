-- Gestão de contabilidades e empresas do Sindicato (Renan cobra guias assistenciais via WhatsApp)
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_contabilidades (
  id            SERIAL PRIMARY KEY,
  external_id   VARCHAR(50) UNIQUE NOT NULL,
  razao_social  VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  cnpj          VARCHAR(20),
  endereco      VARCHAR(255),
  bairro        VARCHAR(100),
  cidade        VARCHAR(100),
  estado        VARCHAR(2),
  cep           VARCHAR(15),
  telefone      VARCHAR(25),
  celular       VARCHAR(25),
  email         VARCHAR(255),
  status        VARCHAR(30),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_empresas (
  id                SERIAL PRIMARY KEY,
  external_id       VARCHAR(50) UNIQUE NOT NULL,
  razao_social      VARCHAR(255) NOT NULL,
  nome_fantasia     VARCHAR(255),
  cnpj              VARCHAR(20),
  cnae              VARCHAR(255),
  endereco          VARCHAR(255),
  complemento       VARCHAR(255),
  bairro            VARCHAR(100),
  cidade            VARCHAR(100),
  estado            VARCHAR(2),
  cep               VARCHAR(15),
  telefone          VARCHAR(25),
  celular           VARCHAR(25),
  email             VARCHAR(255),
  whatsapp          VARCHAR(25),
  status            VARCHAR(30),
  porte             VARCHAR(20),
  categoria         VARCHAR(100),
  contabilidade_id  INTEGER REFERENCES sindicato_contabilidades(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_cobrancas (
  id                SERIAL PRIMARY KEY,
  empresa_id        INTEGER NOT NULL REFERENCES sindicato_empresas(id) ON DELETE CASCADE,
  enviado_por_id    INTEGER REFERENCES internal_collaborators(id),
  numero_guia       VARCHAR(50) NOT NULL,
  valor             NUMERIC(10,2) NOT NULL,
  data_vencimento   DATE NOT NULL,
  mensagem_gerada   TEXT,
  telefone_usado    VARCHAR(25),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sindicato_contab_external   ON sindicato_contabilidades(external_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_contab_cnpj        ON sindicato_contabilidades(cnpj);

CREATE INDEX IF NOT EXISTS idx_sindicato_empresas_external  ON sindicato_empresas(external_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_empresas_contab    ON sindicato_empresas(contabilidade_id);
CREATE INDEX IF NOT EXISTS idx_sindicato_empresas_cnpj      ON sindicato_empresas(cnpj);

CREATE INDEX IF NOT EXISTS idx_sindicato_cobrancas_empresa  ON sindicato_cobrancas(empresa_id);

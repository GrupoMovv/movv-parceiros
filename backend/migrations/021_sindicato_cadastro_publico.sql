-- Cadastro público de associados SECI (portal.grupomovv.com.br/cadastrar).
-- sindicato_empresas_contribuintes é uma base DIFERENTE de sindicato_empresas
-- (registro cadastral vindo do Higestor, migration 012): aqui é o status de
-- pagamento das guias mensais (empresas_pagantes.json), usado só pra liberar
-- ou bloquear o autocadastro por CNPJ. cnpj fica em dígitos puros (14) pra
-- lookup exato, sem depender de formatação.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_empresas_contribuintes (
  id                  SERIAL PRIMARY KEY,
  cnpj                VARCHAR(14) UNIQUE NOT NULL,
  razao_social        VARCHAR(255) NOT NULL,
  nome_fantasia       VARCHAR(255),
  endereco            VARCHAR(255),
  complemento         VARCHAR(255),
  bairro              VARCHAR(100),
  cidade              VARCHAR(100),
  estado              VARCHAR(2),
  cep                 VARCHAR(15),
  telefone            VARCHAR(25),
  celular             VARCHAR(25),
  email               VARCHAR(255),
  status              VARCHAR(20) NOT NULL DEFAULT 'adimplente'
                        CHECK (status IN ('adimplente', 'atrasada', 'inativa')),
  total_pago_periodo  NUMERIC(12,2),
  meses_pagos         SMALLINT,
  ultima_atualizacao  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sindicato_solicitacoes_empresa (
  id                    SERIAL PRIMARY KEY,
  cnpj_digitado         VARCHAR(20) NOT NULL,
  nome_solicitante      VARCHAR(255) NOT NULL,
  whatsapp_solicitante  VARCHAR(20) NOT NULL,
  cargo                 VARCHAR(100),
  nome_empresa          VARCHAR(255),
  mensagem              TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente', 'contatado', 'convertido', 'rejeitado')),
  atendido_por_id       INTEGER REFERENCES internal_collaborators(id),
  atendido_em           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de importações da planilha de empresas pagantes (upload admin).
CREATE TABLE IF NOT EXISTS sindicato_contribuintes_importacoes (
  id                SERIAL PRIMARY KEY,
  importado_por_id  INTEGER REFERENCES internal_collaborators(id),
  novas             INTEGER NOT NULL DEFAULT 0,
  atualizadas       INTEGER NOT NULL DEFAULT 0,
  status_mudou      INTEGER NOT NULL DEFAULT 0,
  total_linhas      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sindicato_contribuintes_status   ON sindicato_empresas_contribuintes(status);
CREATE INDEX IF NOT EXISTS idx_sindicato_solicitacoes_status    ON sindicato_solicitacoes_empresa(status);
CREATE INDEX IF NOT EXISTS idx_sindicato_solicitacoes_cnpj      ON sindicato_solicitacoes_empresa(cnpj_digitado);

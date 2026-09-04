-- Lista de colaboradores pré-aprovados de empresas parceiras (ex.: Reis) —
-- admin importa a planilha do RH, colaborador se autocadastra validando
-- CPF+CNPJ contra essa lista em /cadastrar-associado, sem precisar do
-- Sindicato aprovar um por um depois da importação inicial.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_lista_aprovada (
  id                     SERIAL PRIMARY KEY,
  cnpj_empresa           VARCHAR(20) NOT NULL,
  razao_social_empresa   VARCHAR(200),
  cpf_colaborador        VARCHAR(15) NOT NULL,
  nome_colaborador       VARCHAR(200) NOT NULL,
  matricula_interna      VARCHAR(50),
  valor_mensal           DECIMAL(10,2) NOT NULL DEFAULT 10.70,
  status                 VARCHAR(50) NOT NULL DEFAULT 'pendente_ativacao'
                            CHECK (status IN ('pendente_ativacao', 'ativado', 'cancelado')),
  data_importacao        TIMESTAMPTZ DEFAULT NOW(),
  ativado_em             TIMESTAMPTZ,
  associado_id           INTEGER REFERENCES sindicato_associados(id),
  observacoes            TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cpf_colaborador, cnpj_empresa)
);

CREATE INDEX IF NOT EXISTS idx_lista_aprovada_cpf    ON sindicato_lista_aprovada(cpf_colaborador);
CREATE INDEX IF NOT EXISTS idx_lista_aprovada_cnpj   ON sindicato_lista_aprovada(cnpj_empresa);
CREATE INDEX IF NOT EXISTS idx_lista_aprovada_status ON sindicato_lista_aprovada(status);
CREATE INDEX IF NOT EXISTS idx_lista_aprovada_razao  ON sindicato_lista_aprovada(razao_social_empresa);

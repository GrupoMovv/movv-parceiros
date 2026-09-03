-- Bloco 9 do IUB MAIS: pagina publica /vender — qualquer comerciante se
-- cadastra livre, fica "pendente" aqui ate o admin (Junior) ou o Renan
-- (sindicato_aprendiz) aprovar. Aprovar cria o registro real em
-- sindicato_parceiros + o login em sindicato_parceiro_usuarios.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_parceiros_solicitacoes (
  id                  SERIAL PRIMARY KEY,
  segmento            VARCHAR(30) NOT NULL,
  nome_fantasia       VARCHAR(160) NOT NULL,
  razao_social        VARCHAR(255),
  cnpj                VARCHAR(18) NOT NULL,
  categoria_principal VARCHAR(60),
  descricao_curta     VARCHAR(200),
  endereco            VARCHAR(255),
  bairro              VARCHAR(120),
  cidade              VARCHAR(120) NOT NULL DEFAULT 'Itumbiara',
  estado              VARCHAR(2)  NOT NULL DEFAULT 'GO',
  whatsapp            VARCHAR(20) NOT NULL,
  email               VARCHAR(255) NOT NULL,
  instagram           VARCHAR(255),
  responsavel_nome    VARCHAR(160) NOT NULL,
  responsavel_cpf     VARCHAR(14) NOT NULL,
  responsavel_cargo   VARCHAR(80),
  termos_aceitos_em   TIMESTAMPTZ NOT NULL,
  termos_ip           VARCHAR(64),
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacoes_admin   TEXT,
  aprovado_em         TIMESTAMPTZ,
  aprovado_por        VARCHAR(255),
  parceiro_id         INTEGER REFERENCES sindicato_parceiros(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sindicato_parceiros_solicitacoes_status ON sindicato_parceiros_solicitacoes(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiros_solicitacoes_ip     ON sindicato_parceiros_solicitacoes(termos_ip, created_at);

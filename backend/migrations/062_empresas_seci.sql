-- Base SECI: quem está em dia com o Sindicato (empresas por CNPJ e filiados
-- pessoa física por CPF), alimentada pelo "Relatório de Recebimentos" do
-- Higestor em /sindicato/base-seci. Substitui sindicato_empresas_contribuintes
-- (migrations 021/040/045), que fica congelada só pra rollback — ninguém
-- mais lê nem escreve nela.
--
-- Regra dos 3 meses (tolerância do Sindicato): em_dia = o último pagamento
-- (mes_referencia) caiu no mês do arquivo importado ou nos 2 anteriores.
-- Quem some do relatório de um mês NÃO vira devendo na hora — só quando o
-- último pagamento sai da janela. Ver baseSeciService.js.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS empresas_seci (
  id                    SERIAL PRIMARY KEY,
  -- só dígitos (11 = CPF, 14 = CNPJ): chave de busca, sem depender de máscara
  cnpj_cpf              VARCHAR(18) UNIQUE NOT NULL
                          CHECK (cnpj_cpf ~ '^([0-9]{11}|[0-9]{14})$'),
  tipo_documento        VARCHAR(4) NOT NULL CHECK (tipo_documento IN ('cpf', 'cnpj')),
  -- formato como veio no arquivo, só pra exibição
  documento_exibicao    VARCHAR(20),
  razao_social          VARCHAR(255) NOT NULL,
  nome_fantasia         VARCHAR(255),
  codigo_filiado        VARCHAR(50),
  em_dia                BOOLEAN NOT NULL DEFAULT true,
  -- mês ('2026-08') do último pagamento creditado, não a "Referência" do título
  mes_referencia        VARCHAR(7) CHECK (mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'),
  ultimo_valor_pago     DECIMAL(10,2),
  -- empresas do grupo que não pagam guia mas ficam sempre liberadas (ex.:
  -- Open Gestão) — nunca viram devendo por ausência no relatório
  sempre_ativa          BOOLEAN NOT NULL DEFAULT false,
  observacoes_ativacao  TEXT,
  criado_em             TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- cnpj_cpf já tem índice pelo UNIQUE.
CREATE INDEX IF NOT EXISTS idx_empresas_seci_em_dia ON empresas_seci(em_dia);

CREATE TABLE IF NOT EXISTS empresas_seci_importacoes (
  id                   SERIAL PRIMARY KEY,
  importado_por_id     INTEGER REFERENCES internal_collaborators(id),
  arquivo_nome         VARCHAR(255),
  mes_referencia       VARCHAR(7) NOT NULL,
  titulos_quitados     BOOLEAN NOT NULL DEFAULT false,
  total_empresas       INTEGER NOT NULL DEFAULT 0,  -- documentos distintos no arquivo
  total_arrecadado     DECIMAL(12,2) NOT NULL DEFAULT 0,  -- no mes_referencia
  arrecadado_por_mes   JSONB NOT NULL DEFAULT '{}',  -- {"2026-07": 123.45, ...}
  novos                INTEGER NOT NULL DEFAULT 0,
  renovados            INTEGER NOT NULL DEFAULT 0,
  voltaram_em_dia      INTEGER NOT NULL DEFAULT 0,
  marcados_devendo     INTEGER NOT NULL DEFAULT 0,
  total_em_dia_depois  INTEGER NOT NULL DEFAULT 0,
  criado_em            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_seci_importacoes_mes ON empresas_seci_importacoes(mes_referencia);

-- Cópia única da base antiga: só roda enquanto empresas_seci estiver vazia,
-- então pega o estado mais recente de sindicato_empresas_contribuintes no
-- dia em que a migration for aplicada e nunca mais mexe (run.js reexecuta
-- todas as migrations a cada chamada).
-- A base antiga guardava a COMPETÊNCIA do título (MAIO, pago em junho); a
-- nova guarda o mês do CRÉDITO, que costuma ser o seguinte. Sem o +1 mês,
-- quem pagou em junho a guia de maio cai fora da janela jun–ago já na
-- primeira importação mensal (testado: 21 empresas viravam devendo com o
-- relatório de agosto). O +1 erra, quando erra, a favor da tolerância, e só
-- vale até o próximo pagamento de cada empresa.
INSERT INTO empresas_seci
  (cnpj_cpf, tipo_documento, documento_exibicao, razao_social, nome_fantasia, em_dia,
   mes_referencia, sempre_ativa, observacoes_ativacao, criado_em, atualizado_em)
SELECT
  c.cnpj, 'cnpj',
  regexp_replace(c.cnpj, '^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$', '\1.\2.\3/\4-\5'),
  c.razao_social, c.nome_fantasia,
  (c.status = 'adimplente' OR c.sempre_ativa),
  to_char(c.ultimo_mes_pagamento + INTERVAL '1 month', 'YYYY-MM'),
  c.sempre_ativa, c.observacoes_ativacao,
  COALESCE(c.created_at, NOW()), NOW()
FROM sindicato_empresas_contribuintes c
WHERE c.cnpj ~ '^[0-9]{14}$'
  AND NOT EXISTS (SELECT 1 FROM empresas_seci)
ON CONFLICT (cnpj_cpf) DO NOTHING;

-- Livro único de comissões do MOVV Partner (Junior, 13/10/2026).
--
-- Decisões: base da comissão = o que o Grupo de fato recebeu (na Azul, o
-- VALOR COMISSAO da linha do relatório); percentual por origem/produto ×
-- nível, copiado para dentro de cada lançamento na hora em que ele nasce
-- (mudar a regra depois não mexe em lançamento antigo); o Partner vê base,
-- percentual e valor de cada lançamento dele (decisão A, transparência) e
-- nada interno (regra_id, quem aprovou/pagou, observação, outros níveis).
--
-- Status: previsto -> confirmado -> aprovado -> pago, e estornado (de
-- qualquer um). Sem pular etapa: quem garante é o serviço
-- (services/partnerComissoes.js), com UPDATE ... WHERE status = <anterior>.
--
-- Dinheiro em NUMERIC(12,2). valor_partner = ROUND(base × percentual / 100, 2)
-- (ROUND do Postgres em NUMERIC arredonda meio para cima, longe do zero;
-- como a base nunca é negativa, é o ROUND_HALF_UP). O serviço calcula em
-- centavos inteiros e o CHECK confere.
--
-- Etapa 2 (importação da Azul) usa comissao_importacoes e
-- comissao_importacao_linhas; elas já nascem aqui, ainda sem uso.
-- Federal Invest e seguro de carro: só a origem está prevista, sem código.
-- Execute: node migrations/run.js

-- 1. Venda Azul com Partner responsável (casamento da Etapa 2) e Partner
--    responsável na venda do Movv Certificado
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS client_cpf      VARCHAR(11),   -- só dígitos
  ADD COLUMN IF NOT EXISTS numero_contrato VARCHAR(30);   -- texto, nunca número
CREATE INDEX IF NOT EXISTS idx_referrals_client_cpf      ON referrals (client_cpf)      WHERE client_cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_numero_contrato ON referrals (numero_contrato) WHERE numero_contrato IS NOT NULL;

ALTER TABLE direta_sales ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES partners(id);
CREATE INDEX IF NOT EXISTS idx_direta_sales_partner ON direta_sales (partner_id) WHERE partner_id IS NOT NULL;

-- 2. Regras (a "Tabela vigente"): origem/produto × nível
CREATE TABLE IF NOT EXISTS partner_comissao_regras (
  id             SERIAL PRIMARY KEY,
  origem         VARCHAR(30)  NOT NULL CHECK (origem IN ('azul','certificado','federal_invest','seguro_auto')),
  produto        VARCHAR(200),                       -- NULL = vale para todos os produtos da origem
  nivel_partner  VARCHAR(20)  NOT NULL CHECK (nivel_partner IN ('mobile','point','hub','regional')),
  -- sobre o que o percentual incide:
  --   comissao_recebida: o que o Grupo recebeu (Azul: VALOR COMISSAO)
  --   valor_venda:       Movv Certificado, total da venda (certificado + token)
  --   lucro_grupo:       Movv Certificado, preço de venda − custos (certificado
  --                      + compra do token); não desconta comissões
  base           VARCHAR(20)  NOT NULL CHECK (base IN ('comissao_recebida','valor_venda','lucro_grupo')),
  percentual     NUMERIC(7,4) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  vigente_desde  DATE         NOT NULL,
  vigente_ate    DATE,
  observacao     TEXT,
  criado_por     VARCHAR(300) NOT NULL,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_por VARCHAR(300),
  atualizado_em  TIMESTAMPTZ,
  CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_desde),
  CHECK (origem <> 'azul'        OR base = 'comissao_recebida'),
  CHECK (origem <> 'certificado' OR base IN ('valor_venda','lucro_grupo'))
);
-- sobreposição de vigência é barrada no serviço; aqui só o caso exato
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcr_unica
  ON partner_comissao_regras (origem, COALESCE(LOWER(produto), ''), nivel_partner, vigente_desde);

-- Azul: 30% para todos os produtos e todos os níveis
INSERT INTO partner_comissao_regras (origem, produto, nivel_partner, base, percentual, vigente_desde, criado_por, observacao)
SELECT 'azul', NULL, n, 'comissao_recebida', 30.0000, DATE '2026-01-01', 'migration 093', 'Regra inicial: 30% da comissão recebida, todos os produtos'
FROM unnest(ARRAY['mobile','point','hub','regional']) AS n
-- só se ainda não houver regra da Azul para o nível (rodar de novo não
-- recoloca 30% por cima do que o admin encerrou ou trocou)
WHERE NOT EXISTS (SELECT 1 FROM partner_comissao_regras r WHERE r.origem = 'azul' AND r.nivel_partner = n)
ON CONFLICT DO NOTHING;
-- Movv Certificado: 20% do lucro do Grupo na venda (preço − custos: R$ 19,90
-- do certificado + compra do token), todos os níveis, desde 13/10/2026.
-- Venda anterior a isso não tem regra: não gera lançamento e vira aviso.
INSERT INTO partner_comissao_regras (origem, produto, nivel_partner, base, percentual, vigente_desde, criado_por, observacao)
SELECT 'certificado', NULL, n, 'lucro_grupo', 20.0000, DATE '2026-10-13', 'migration 093', 'Regra inicial: 20% do lucro do Grupo (preço − custos)'
FROM unnest(ARRAY['mobile','point','hub','regional']) AS n
WHERE NOT EXISTS (SELECT 1 FROM partner_comissao_regras r WHERE r.origem = 'certificado' AND r.nivel_partner = n)
ON CONFLICT DO NOTHING;

-- 3. Importação mensal (Etapa 2)
CREATE TABLE IF NOT EXISTS comissao_importacoes (
  id                   SERIAL PRIMARY KEY,
  origem               VARCHAR(30)   NOT NULL CHECK (origem IN ('azul','federal_invest','seguro_auto')),
  formato              VARCHAR(20)   NOT NULL CHECK (formato IN ('csv_domus','xls_azul')),
  arquivo_nome         VARCHAR(300)  NOT NULL,
  arquivo_hash         CHAR(64)      NOT NULL,       -- sha256 do arquivo (o mesmo arquivo pode voltar: as linhas é que não duplicam)
  periodo_de           DATE,
  periodo_ate          DATE,
  linhas_total         INTEGER       NOT NULL DEFAULT 0,
  linhas_novas         INTEGER       NOT NULL DEFAULT 0,
  linhas_ja_importadas INTEGER       NOT NULL DEFAULT 0,
  contagens            JSONB         NOT NULL DEFAULT '{}',  -- novas por situação (casada, sugestao, ambigua, sem_partner...)
  total_incentivo      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- soma das linhas PAGA do arquivo (nunca o rodapé do relatório)
  total_descontos      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_partners       NUMERIC(12,2) NOT NULL DEFAULT 0,  -- lançado para Partners nesta importação (casadas por contrato)
  importado_por_id     INTEGER,
  importado_por        VARCHAR(300)  NOT NULL,
  importado_em         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comissao_importacao_linhas (
  id                   SERIAL PRIMARY KEY,
  importacao_id        INTEGER       NOT NULL REFERENCES comissao_importacoes(id) ON DELETE CASCADE,
  linha_numero         INTEGER       NOT NULL,
  -- sha256(numero_contrato | dt_pagamento | valor_comissao | situacao | ocorrência no arquivo)
  chave_linha          CHAR(64)      NOT NULL UNIQUE,
  tipo                 VARCHAR(20)   NOT NULL CHECK (tipo IN ('comissao','estorno','desconto')),
  numero_contrato      VARCHAR(30),
  cliente_nome         VARCHAR(255),
  cliente_cpf          VARCHAR(11),                  -- só dígitos; nunca em log nem relatório
  banco                VARCHAR(120),
  produto              VARCHAR(200),
  valor_emprestimo     NUMERIC(12,2),
  valor_comissao       NUMERIC(12,2) NOT NULL,
  percentual_comissao  NUMERIC(7,4),
  dt_operacao          DATE,
  dt_emissao           DATE,
  dt_pagamento         DATE,
  competencia          VARCHAR(7),
  situacao             VARCHAR(20),
  origem_relatorio     VARCHAR(60),
  observacao           TEXT,
  cod_agente           VARCHAR(30),
  -- casada:            contrato igual ao de uma indicação de Partner -> lançamento
  -- sugestao:          só o CPF casou com UMA indicação sem contrato -> admin confirma
  -- ambigua:           o CPF casou com mais de uma indicação -> admin escolhe
  -- sem_partner:       venda da própria agência (a maioria); só conta nos totais
  -- vinculada:         admin confirmou/escolheu/vinculou -> lançamento
  -- sem_regra:         é de Partner, mas sem regra vigente ou Partner sem nível
  -- estorno_a_decidir: ESTORNADA de contrato de Partner; política a definir
  -- estorno_resolvido: o admin decidiu (estornou o lançamento ou manteve)
  -- desconto:          desconto da agência, sem contrato; nunca gera lançamento
  status               VARCHAR(20)   NOT NULL
                         CHECK (status IN ('casada','sugestao','ambigua','sem_partner','vinculada','sem_regra',
                                           'estorno_a_decidir','estorno_resolvido','desconto')),
  referral_id          INTEGER       REFERENCES referrals(id),
  partner_id           INTEGER       REFERENCES partners(id),
  sugestao_referral_id INTEGER       REFERENCES referrals(id),   -- casou só pelo CPF: pede confirmação
  lancamento_estorno_id INTEGER,                                -- lançamento que o estorno da Azul atinge
  motivo               TEXT,
  resolvido_por        VARCHAR(300),
  resolvido_em         TIMESTAMPTZ,
  UNIQUE (importacao_id, linha_numero)
);
CREATE INDEX IF NOT EXISTS idx_cil_status   ON comissao_importacao_linhas (status)
  WHERE status IN ('sugestao','ambigua','sem_regra','estorno_a_decidir');
CREATE INDEX IF NOT EXISTS idx_cil_cpf      ON comissao_importacao_linhas (cliente_cpf) WHERE cliente_cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cil_contrato ON comissao_importacao_linhas (numero_contrato) WHERE numero_contrato IS NOT NULL;

-- 4. O livro
CREATE TABLE IF NOT EXISTS partner_comissoes (
  id                   SERIAL PRIMARY KEY,
  partner_id           INTEGER       NOT NULL REFERENCES partners(id),
  origem               VARCHAR(30)   NOT NULL CHECK (origem IN ('azul','certificado','federal_invest','seguro_auto')),
  produto              VARCHAR(200)  NOT NULL,
  referral_id          INTEGER       REFERENCES referrals(id),
  direta_sale_id       INTEGER       REFERENCES direta_sales(id),
  numero_contrato      VARCHAR(30),
  cliente_nome         VARCHAR(255),
  competencia          VARCHAR(7)    NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  base_valor           NUMERIC(12,2) NOT NULL CHECK (base_valor >= 0),
  percentual           NUMERIC(7,4)  NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  valor_partner        NUMERIC(12,2) NOT NULL,
  regra_id             INTEGER       REFERENCES partner_comissao_regras(id),  -- interno
  lancado_manualmente  BOOLEAN       NOT NULL DEFAULT false,
  status               VARCHAR(20)   NOT NULL DEFAULT 'previsto'
                         CHECK (status IN ('previsto','confirmado','aprovado','pago','estornado')),
  confirmado_em        TIMESTAMPTZ,
  confirmado_por       VARCHAR(300),
  aprovado_em          TIMESTAMPTZ,
  aprovado_por         VARCHAR(300),
  pago_em              DATE,                         -- data do pagamento informada pelo admin
  pago_registrado_em   TIMESTAMPTZ,
  pago_por             VARCHAR(300),
  observacao_pagamento TEXT,
  estornado_em         TIMESTAMPTZ,
  estornado_por        VARCHAR(300),
  motivo_estorno       TEXT,
  status_antes_estorno VARCHAR(20),
  observacao           TEXT,                         -- interna
  chave_idempotencia   VARCHAR(120)  UNIQUE,         -- NULL permitido (manual)
  importacao_linha_id  INTEGER       REFERENCES comissao_importacao_linhas(id),
  criado_por           VARCHAR(300)  NOT NULL,
  criado_em            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT pc_valor_partner_confere CHECK (valor_partner = ROUND(base_valor * percentual / 100, 2)),
  CONSTRAINT pc_confirmado_tem_data   CHECK (status = 'previsto' OR status = 'estornado' OR confirmado_em IS NOT NULL),
  CONSTRAINT pc_aprovado_tem_data     CHECK (status NOT IN ('aprovado','pago') OR aprovado_em IS NOT NULL),
  CONSTRAINT pc_pago_tem_data         CHECK (status <> 'pago' OR (pago_em IS NOT NULL AND pago_por IS NOT NULL)),
  CONSTRAINT pc_estorno_tem_motivo    CHECK (status <> 'estornado' OR (estornado_em IS NOT NULL AND motivo_estorno IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_pc_partner_comp ON partner_comissoes (partner_id, competencia);
CREATE INDEX IF NOT EXISTS idx_pc_status       ON partner_comissoes (status);
CREATE INDEX IF NOT EXISTS idx_pc_origem       ON partner_comissoes (origem);
CREATE INDEX IF NOT EXISTS idx_pc_direta_sale  ON partner_comissoes (direta_sale_id) WHERE direta_sale_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pc_linha ON partner_comissoes (importacao_linha_id) WHERE importacao_linha_id IS NOT NULL;

-- 5. Avisos do admin: venda que deveria gerar lançamento e não gerou
--    (sem regra vigente, Partner sem nível etc.). "Tentar de novo" no admin.
CREATE TABLE IF NOT EXISTS partner_comissao_avisos (
  id             SERIAL PRIMARY KEY,
  origem         VARCHAR(30)  NOT NULL,
  direta_sale_id INTEGER      REFERENCES direta_sales(id),
  partner_id     INTEGER      REFERENCES partners(id),
  motivo         TEXT         NOT NULL,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolvido_em   TIMESTAMPTZ,
  resolvido_por  VARCHAR(300),
  resolucao      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pca_aberto_venda
  ON partner_comissao_avisos (direta_sale_id) WHERE resolvido_em IS NULL AND direta_sale_id IS NOT NULL;

-- 6. O que o Partner enxerga: só as colunas da decisão A e só as linhas
--    dele. O servidor grava o id do Partner logado na transação
--    (set_config('movv.partner_id', ..., true)); sem isso a view volta vazia.
CREATE OR REPLACE VIEW v_partner_comissoes_partner AS
SELECT pc.id, pc.origem, pc.produto, pc.cliente_nome, pc.numero_contrato,
       pc.competencia, pc.base_valor, pc.percentual, pc.valor_partner,
       pc.status, (pc.status = 'estornado') AS eh_estorno,
       pc.confirmado_em, pc.aprovado_em, pc.pago_em, pc.estornado_em, pc.criado_em
FROM partner_comissoes pc
WHERE pc.partner_id = NULLIF(current_setting('movv.partner_id', true), '')::int;

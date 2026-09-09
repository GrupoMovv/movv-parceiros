-- Reestruturação do módulo Direta Certificação (Fernando): contabilidade
-- deixa de ter preço fixo — Fernando negocia o valor da venda e a comissão
-- da contabilidade caso a caso, direto no registro da venda (mesma regra
-- de escalonamento de comissão 20/22,5/25% de sempre, só muda a BASE do
-- cálculo). Histórico de vendas anteriores a esta migration NÃO é
-- recalculado — mantém o `lucro`/`comissao_valor` gravado na época com a
-- regra antiga (comissão sobre venda-custo). Ver
-- diretaCalcService.calcularComissaoVenda pra regra nova.
-- Execute: node migrations/run.js

-- contabilidades_precos vira o cadastro da contabilidade em si (nome/
-- email/whatsapp já moram em partners; aqui só o que faltava pro cadastro
-- completo). Preço deixa de ser obrigatório e deixa de ser usado pra
-- calcular venda (ver diretaSalesController.createSale) — a coluna fica
-- só como referência/histórico de quem já tinha preço fixo cadastrado.
ALTER TABLE contabilidades_precos
  ALTER COLUMN preco_certificado DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS cnpj             VARCHAR(18),
  ADD COLUMN IF NOT EXISTS endereco         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cidade           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS responsavel_nome VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contab_precos_cnpj ON contabilidades_precos (cnpj) WHERE cnpj IS NOT NULL;

-- Backfill: toda contabilidade (partners type='accounting') que já
-- existia sem nunca ter tido preço/cadastro extra ganha sua linha 1:1
-- aqui agora (ativa, herdando partners.is_active) — a partir desta
-- migration toda contabilidade sempre tem essa linha, criada junto no
-- cadastro (ver contabilidadesPrecosController.createContabilidade).
INSERT INTO contabilidades_precos (partner_id, ativo)
SELECT p.id, p.is_active
FROM partners p
WHERE p.type = 'accounting'
  AND NOT EXISTS (SELECT 1 FROM contabilidades_precos cp WHERE cp.partner_id = p.id);

-- direta_sales: nova coluna pra comissão da contabilidade negociada caso
-- a caso (só preenchida quando tipo_venda = 'contabilidade'). status
-- ganha 'excluida', distinto de 'cancelada' — exclusão é "cadastrei
-- errado" (remove da listagem normal), cancelamento é "a venda não foi
-- pra frente" (mantém visível, só não conta na folha).
ALTER TABLE direta_sales
  ADD COLUMN IF NOT EXISTS comissao_contabilidade_valor DECIMAL(10,2);

ALTER TABLE direta_sales DROP CONSTRAINT IF EXISTS direta_sales_status_check;
ALTER TABLE direta_sales ADD CONSTRAINT direta_sales_status_check
  CHECK (status IN ('confirmada', 'cancelada', 'excluida'));

-- Auditoria de edição/exclusão/cancelamento de venda: quem, quando, por
-- quê, e snapshot antes/depois em JSON (schema-agnostic, não precisa
-- espelhar toda coluna de direta_sales aqui).
CREATE TABLE IF NOT EXISTS direta_sales_historico (
  id            SERIAL PRIMARY KEY,
  venda_id      INTEGER NOT NULL REFERENCES direta_sales(id) ON DELETE CASCADE,
  acao          VARCHAR(20) NOT NULL CHECK (acao IN ('criada', 'editada', 'cancelada', 'excluida')),
  motivo        TEXT,
  dados_antes   JSONB,
  dados_depois  JSONB,
  alterado_por  VARCHAR(150) NOT NULL,
  alterado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_direta_sales_historico_venda ON direta_sales_historico(venda_id, alterado_em DESC);

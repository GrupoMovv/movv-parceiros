-- Segundo produto do Fernando: Token (dispositivo/software), opcional em
-- cada venda, além do certificado (que continua obrigatório em toda venda).
-- Escalonamento de comissão (20/22,5/25%) aplica separado em cada produto,
-- sobre a mesma % do mês (ver diretaCalcService.calcularVenda).
--
-- Os campos do CERTIFICADO continuam com os nomes físicos de sempre
-- (preco_venda, comissao_contabilidade_valor, comissao_valor, lucro) DE
-- PROPÓSITO — não renomeamos a coluna em produção porque o backend atual
-- (já no ar) lê esses nomes; um RENAME COLUMN quebraria toda requisição
-- entre a migration rodar e o deploy do código novo terminar. A API
-- expõe os nomes novos (valor_venda_certificado, comissao_vendedor_certificado
-- etc.) via alias nas queries (ver diretaSalesController) — mesmo
-- resultado pra quem consome a API, sem risco de downtime.
-- Execute: node migrations/run.js

ALTER TABLE direta_sales
  ADD COLUMN IF NOT EXISTS incluiu_token             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_compra_token         DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS valor_venda_token          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS comissao_contab_token      DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_vendedor_token    DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lucro_movv_token           DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_venda                DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_comissao_vendedor    DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_lucro_movv           DECIMAL(10,2);

-- Backfill: vendas de antes desta migration não tinham token — os totais
-- ficam iguais ao que já existia só de certificado (não recalcula nada,
-- só espelha o valor certificado já gravado nas colunas de total novas,
-- pra folha/relatórios poderem somar total_* uniformemente pra
-- vendas antigas e novas sem `COALESCE` espalhado pelo código).
UPDATE direta_sales
SET total_venda = preco_venda,
    total_comissao_vendedor = comissao_valor,
    total_lucro_movv = lucro
WHERE total_venda IS NULL;

ALTER TABLE direta_sales
  ALTER COLUMN total_venda SET NOT NULL,
  ALTER COLUMN total_comissao_vendedor SET NOT NULL,
  ALTER COLUMN total_lucro_movv SET NOT NULL;

-- Regra de comissão do Seguros para o MOVV Partner (Junior, 14/10/2026).
-- Seguros em geral (auto, residencial, vida, empresarial): 20% da comissão
-- que o Grupo de fato recebeu, os quatro níveis, desde 14/10/2026.
--
-- - Nova origem 'seguro' nos lançamentos e nas regras (a 093 só aceitava
--   azul, certificado, federal_invest e seguro_auto). 'seguro_auto' fica,
--   sem uso, para não quebrar nada.
-- - O seguro vem de OUTRO sistema, não do relatório da Azul: a importação
--   da Azul não muda (comissao_importacoes continua sem 'seguro').
-- - Idempotente: as restrições são recriadas (achadas pela definição, não
--   pelo nome) e a regra inicial só entra se ainda não houver regra de
--   seguro para o nível.
-- Execute: node migrations/run.js

-- 1. Aceitar a origem 'seguro' (regras e lançamentos)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tabela, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('partner_comissao_regras'::regclass, 'partner_comissoes'::regclass)
      AND pg_get_constraintdef(oid) LIKE '%(origem)::text = ANY%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tabela, c.conname);
  END LOOP;
END $$;

ALTER TABLE partner_comissao_regras ADD CONSTRAINT partner_comissao_regras_origem_check
  CHECK (origem IN ('azul','certificado','seguro','federal_invest','seguro_auto'));
ALTER TABLE partner_comissoes ADD CONSTRAINT partner_comissoes_origem_check
  CHECK (origem IN ('azul','certificado','seguro','federal_invest','seguro_auto'));

-- 2. Seguro sempre sobre a comissão recebida pelo Grupo
ALTER TABLE partner_comissao_regras DROP CONSTRAINT IF EXISTS pcr_seguro_base;
ALTER TABLE partner_comissao_regras ADD CONSTRAINT pcr_seguro_base
  CHECK (origem <> 'seguro' OR base = 'comissao_recebida');

-- 3. Regra inicial: 20% da comissão recebida, todos os seguros e níveis
INSERT INTO partner_comissao_regras (origem, produto, nivel_partner, base, percentual, vigente_desde, criado_por, observacao)
SELECT 'seguro', NULL, n, 'comissao_recebida', 20.0000, DATE '2026-10-14', 'migration 095',
       'Regra inicial: 20% da comissão recebida, todos os seguros (auto, residencial, vida, empresarial)'
FROM unnest(ARRAY['mobile','point','hub','regional']) AS n
WHERE NOT EXISTS (SELECT 1 FROM partner_comissao_regras r WHERE r.origem = 'seguro' AND r.nivel_partner = n)
ON CONFLICT DO NOTHING;

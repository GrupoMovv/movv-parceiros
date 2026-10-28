-- MOVV CRED (Junior, 28/10/2026): crédito do próprio Grupo Movv, que NÃO
-- passa pela Azul. A comissão do Partner é lançada à mão (Comissões do
-- Partner > Lançamento manual) com a origem própria 'movv_cred', para não
-- aparecer como "Azul" para o Partner nem nos filtros e relatórios.
--
-- - Nova origem 'movv_cred' nas regras e nos lançamentos, sempre sobre a
--   comissão que o Grupo recebeu (base 'comissao_recebida').
-- - SEM regra de percentual aqui: o admin cadastra em Regras no dia de ativar.
-- - A importação da Azul não muda (comissao_importacoes continua sem
--   'movv_cred') e nenhum lançamento existente é tocado.
-- - Idempotente: as restrições de origem são recriadas (achadas pela
--   definição, como na 095).
-- Execute: node migrations/run.js

-- 1. Aceitar a origem 'movv_cred' (regras e lançamentos)
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
  CHECK (origem IN ('azul','certificado','seguro','movv_cred','federal_invest','seguro_auto'));
ALTER TABLE partner_comissoes ADD CONSTRAINT partner_comissoes_origem_check
  CHECK (origem IN ('azul','certificado','seguro','movv_cred','federal_invest','seguro_auto'));

-- 2. MOVV CRED sempre sobre a comissão recebida pelo Grupo
ALTER TABLE partner_comissao_regras DROP CONSTRAINT IF EXISTS pcr_movv_cred_base;
ALTER TABLE partner_comissao_regras ADD CONSTRAINT pcr_movv_cred_base
  CHECK (origem <> 'movv_cred' OR base = 'comissao_recebida');

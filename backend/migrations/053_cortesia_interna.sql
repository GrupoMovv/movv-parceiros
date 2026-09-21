-- Cortesia interna: parceiros da casa que usam plano pago SEM nunca serem
-- cobrados (substitui a lista PARCEIROS_SEED_DEMONSTRACAO que ficava no
-- código de config/planos.js). Com as assinaturas do Mercado Pago ligadas
-- (migration 052), a regra passou a ser dado do banco:
--   cortesia_interna = true -> plano (o que estiver gravado) nunca vence,
--   nunca é cobrado, e a rotina de assinaturas pula o parceiro.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS cortesia_interna BOOLEAN NOT NULL DEFAULT false;

-- Os 2 que eram "seed de demonstração" rodavam como Premium sem estar
-- gravados assim (plano = 'gratis' no banco + slug numa lista no código).
-- Agora o Premium fica gravado de verdade. WHERE plano = 'gratis' deixa
-- idempotente (migrations/run.js reroda tudo) e não sobrescreve se alguém
-- já tiver mudado o plano deles na mão.
WITH marcados AS (
  UPDATE sindicato_parceiros
     SET cortesia_interna = true, plano = 'premium', plano_ativo_desde = NOW(), plano_expira_em = NULL
   WHERE slug IN ('nossa-drogaria', 'azul-emprestimo') AND plano = 'gratis'
  RETURNING id
)
INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por)
SELECT id, 'gratis', 'premium', 'ativacao_seed', 'Cortesia interna (antigo seed de demonstração) — nunca cobrado', 'migration 053'
  FROM marcados;

-- Idempotente de novo pro caso de já estarem premium: garante a flag.
UPDATE sindicato_parceiros SET cortesia_interna = true
 WHERE slug IN ('nossa-drogaria', 'azul-emprestimo') AND cortesia_interna = false;

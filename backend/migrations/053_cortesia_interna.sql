-- Cortesia interna: parceiros da casa que usam plano pago SEM nunca serem
-- cobrados (substitui a lista PARCEIROS_SEED_DEMONSTRACAO que ficava no
-- código de config/planos.js). Com as assinaturas do Mercado Pago ligadas
-- (migration 052), a regra passou a ser dado do banco:
--   cortesia_interna = true -> plano (o que estiver gravado) nunca vence,
--   nunca é cobrado, e a rotina de assinaturas pula o parceiro.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS cortesia_interna BOOLEAN NOT NULL DEFAULT false;

-- (Removido em 25/09/2026) Aqui os 2 antigos "seed de demonstração"
-- (nossa-drogaria, azul-emprestimo) viravam Premium com cortesia_interna e
-- ganhavam uma linha em sindicato_plano_historico — já aplicado em
-- produção. Com o `npm run migrate` rodando a CADA deploy, trocar o plano
-- ou tirar a cortesia deles pelo painel seria desfeito no deploy seguinte.

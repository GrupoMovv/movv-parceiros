-- A3 (30/10/2026): por que os pedidos pelo site estão pausados.
--   NULL        = pausa da própria loja (botão de hoje) ou não pausada
--   'expirados' = 2 pedidos seguidos passaram de 10 min sem resposta
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS pedidos_pausa_motivo VARCHAR(20);
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS pedidos_pausados_em TIMESTAMPTZ;
-- Quando a loja voltou a receber: a conta dos expirados recomeça daí.
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS pedidos_reativados_em TIMESTAMPTZ;

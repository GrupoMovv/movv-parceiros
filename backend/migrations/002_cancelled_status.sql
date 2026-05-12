-- Adiciona status 'cancelled' na tabela commissions
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'));

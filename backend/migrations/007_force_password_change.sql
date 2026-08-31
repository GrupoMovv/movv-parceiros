-- Força troca de senha no primeiro login para colaboradores internos
ALTER TABLE internal_collaborators
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- Garante que colaboradores já cadastrados sejam marcados para trocar
UPDATE internal_collaborators
  SET must_change_password = true
  WHERE must_change_password IS NULL;

-- Parceiros: padrão false para não bloquear acesso existente
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Admin: marcar para exibir aviso de senha padrão.
--
-- run.js reexecuta TODAS as migrations a cada deploy (não há tabela de
-- controle de migrations aplicadas). Esse UPDATE era incondicional
-- (WHERE is_admin = true, sem checar o valor atual), então todo deploy
-- desfazia a troca de senha que o admin já tinha feito — ele definia uma
-- senha própria, must_change_password virava false, e no próximo deploy
-- voltava pra true, forçando a trocar de novo pra sempre. Guard abaixo
-- restringe à mesma condição que a UPDATE de internal_collaborators já
-- usa (só toca em quem nunca foi setado), tornando idempotente.
UPDATE partners
  SET must_change_password = true
  WHERE is_admin = true
    AND must_change_password IS NULL;

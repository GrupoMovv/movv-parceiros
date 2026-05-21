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

-- Admin: marcar para exibir aviso de senha padrão
UPDATE partners
  SET must_change_password = true
  WHERE is_admin = true;

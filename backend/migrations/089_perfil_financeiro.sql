-- Perfil "financeiro" do Portal Movv (Junior, 09/10/2026, para a ADMIN-002):
-- conta de administrador (is_admin = true no banco, então fica fora das listas
-- de parceiros e protegida como conta admin) que no servidor só abre parceiros,
-- indicações, comissões, pagamentos, comissões internas, indicadores e Movv
-- Certificado. Não vê a área do Sindicato, a verificação de pessoa física nem
-- liga o modo de teste das lojas. NULL = admin completo.
ALTER TABLE partners ADD COLUMN IF NOT EXISTS perfil_admin VARCHAR(20)
  CHECK (perfil_admin IN ('financeiro'));

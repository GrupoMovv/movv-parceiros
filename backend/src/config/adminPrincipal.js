// Conta de administrador principal do portal (Junior, 09/10/2026): só ela
// cria outros admins e edita ou desativa a conta de outro admin. A senha de
// uma conta de admin só o próprio dono troca.
const ADMIN_PRINCIPAL = 'ADMIN-001';

function ehAdminPrincipal(user) {
  return Boolean(user?.is_admin && user.code === ADMIN_PRINCIPAL);
}

module.exports = { ADMIN_PRINCIPAL, ehAdminPrincipal };

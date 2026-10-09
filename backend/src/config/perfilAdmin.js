// Perfil "financeiro" (migration 089, Junior 09/10/2026): no banco é conta
// admin (is_admin = true, fora das listas de parceiros e protegida como admin),
// mas no servidor NÃO é admin — req.user.is_admin = false e req.user.perfil =
// 'financeiro'. Só as rotas com requireEquipe (middleware/auth.js) a aceitam;
// toda rota com requireAdmin continua fechada para ela (Sindicato, verificação
// de pessoa física, testadores, produtos, troca de senha de outras contas).
const PERFIL_FINANCEIRO = 'financeiro';

// Linha de partners -> usuário do portal (login, /auth/me e authenticate).
function contaDoPortal(row) {
  if (!row) return row;
  const { perfil_admin: perfil, ...conta } = row;
  if (perfil === PERFIL_FINANCEIRO) return { ...conta, is_admin: false, perfil: PERFIL_FINANCEIRO };
  return conta;
}

const ehFinanceiro = user => user?.perfil === PERFIL_FINANCEIRO;

// Vê os dados de todos (comissões, pagamentos, indicações), não só os próprios.
const veTudo = user => Boolean(user?.is_admin || ehFinanceiro(user));

module.exports = { PERFIL_FINANCEIRO, contaDoPortal, ehFinanceiro, veTudo };

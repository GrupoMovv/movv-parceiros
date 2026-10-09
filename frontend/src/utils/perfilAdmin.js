// Perfil "financeiro" do portal (migration 089): conta de administrador que
// só vê parceiros, indicações, comissões, pagamentos, comissões internas,
// indicadores e Movv Certificado. O servidor manda is_admin = false e
// perfil = 'financeiro' para ela e recusa o resto (backend/src/config/perfilAdmin.js).
export const ehFinanceiro = user => user?.perfil === 'financeiro';

// Admin completo ou financeiro: abre as telas de dinheiro do /admin.
export const ehEquipe = user => Boolean(user?.is_admin || ehFinanceiro(user));

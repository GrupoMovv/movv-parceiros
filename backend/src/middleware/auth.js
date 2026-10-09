const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { contaDoPortal, veTudo } = require('../config/perfilAdmin');
const { travaDoPortal } = require('../services/universidade');

// Senha provisória (must_change_password): até trocar, o servidor só deixa
// ver a própria conta e trocar a senha — não basta a tela mandar para
// /trocar-senha-obrigatorio (Junior, 09/10/2026, antes da conta do ADMIN-002).
const ROTAS_COM_SENHA_PROVISORIA = ['/api/auth/me', '/api/auth/force-change-password', '/api/auth/change-password'];
function bloquearSenhaProvisoria(req, res, conta) {
  if (!conta?.must_change_password) return false;
  const rota = (req.baseUrl + req.path).replace(/\/+$/, '');
  if (ROTAS_COM_SENHA_PROVISORIA.includes(rota)) return false;
  res.status(403).json({ error: 'Troque a senha provisória antes de continuar.', codigo: 'TROCAR_SENHA' });
  return true;
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.userType === 'internal') {
      const result = await db.query(
        'SELECT id, name, email, role, whatsapp, pix_key, base_salary, must_change_password FROM internal_collaborators WHERE id = $1 AND active = true',
        [decoded.id]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Colaborador não encontrado ou inativo' });
      }
      if (bloquearSenhaProvisoria(req, res, result.rows[0])) return;
      const { must_change_password: _m, ...colab } = result.rows[0]; // eslint-disable-line no-unused-vars
      req.user = { ...colab, type: 'internal', is_admin: false };
    } else if (decoded.userType === 'indicator') {
      const result = await db.query(
        'SELECT id, name, cpf, email, whatsapp, pix_key, pix_key_type, status, total_indications, total_commissions, total_paid, pending_amount FROM indicators WHERE id = $1 AND status = $2',
        [decoded.id, 'approved']
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Indicador não encontrado ou não aprovado' });
      }
      req.user = { ...result.rows[0], type: 'indicator', is_admin: false };
    } else {
      const result = await db.query(
        'SELECT id, code, name, email, type, is_admin, is_active, parent_id, must_change_password, perfil_admin FROM partners WHERE id = $1',
        [decoded.id]
      );
      if (!result.rows[0] || !result.rows[0].is_active) {
        return res.status(401).json({ error: 'Parceiro não encontrado ou inativo' });
      }
      if (bloquearSenhaProvisoria(req, res, result.rows[0])) return;
      const { must_change_password: _m, ...parceiro } = result.rows[0]; // eslint-disable-line no-unused-vars
      req.user = contaDoPortal(parceiro);
      // MOVV Partner sem certificado: com a trava ligada, só Universidade e a própria conta
      if (await travaDoPortal(req, res, req.user)) return;
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
};

// Admin ou perfil financeiro (config/perfilAdmin.js): só nas rotas de
// parceiros, indicações, comissões, pagamentos, comissões internas,
// indicadores e Movv Certificado.
const requireEquipe = (req, res, next) => {
  if (!veTudo(req.user)) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
};

// Universidade MOVV Partner: admin completo ou colaborador interno comercial_full
// (Fernando). O perfil financeiro fica de fora (Junior, 09/10/2026).
const requireAdminUniversidade = (req, res, next) => {
  if (req.user?.is_admin || (req.user?.type === 'internal' && req.user?.role === 'comercial_full')) return next();
  return res.status(403).json({ error: 'Acesso restrito à administração da Universidade' });
};

const requireMovvPartner = (req, res, next) => {
  if (req.user?.type !== 'movv_partner') {
    return res.status(403).json({ error: 'Área exclusiva do MOVV Partner' });
  }
  next();
};

const requireInternal = (req, res, next) => {
  if (req.user?.type !== 'internal') {
    return res.status(403).json({ error: 'Acesso restrito a colaboradores internos' });
  }
  next();
};

// Rota pública com "olho de admin": se vier o JWT do admin (movv_token, que
// a `api` do front já manda sozinha), marca req.modoQa = true — aí a rota
// mostra também as empresas de teste (sindicato_parceiros.empresa_teste).
// Nunca bloqueia: sem token ou token de outro tipo segue como cliente comum.
// req.modoQaMotivo explica por que NÃO ligou (selo de diagnóstico no /beer).
async function marcarModoQa(req, token) {
  req.modoQa = false;
  req.modoQaMotivo = 'sem_login';
  if (!token) return;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userType === 'internal' || decoded.userType === 'indicator' || !decoded.id) {
      req.modoQaMotivo = 'nao_admin';
      return;
    }
    const r = await db.query('SELECT is_admin, is_active, must_change_password, perfil_admin FROM partners WHERE id = $1', [decoded.id]);
    // senha provisória ainda não trocada e perfil financeiro não ligam o modo de teste
    req.modoQa = Boolean(r.rows[0]?.is_admin && r.rows[0]?.is_active && !r.rows[0]?.must_change_password && !r.rows[0]?.perfil_admin);
    req.modoQaMotivo = req.modoQa ? 'ok' : 'nao_admin';
  } catch (err) {
    req.modoQaMotivo = err.name === 'TokenExpiredError' ? 'login_expirado' : 'token_invalido';
  }
}

// Testador (migration 086): conta de CLIENTE que o admin marcou, por até 30
// dias, para ver e comprar nas lojas de teste sem a senha de admin. O token
// é a sessão do /meu (painel_publico); a marca vale só até testador_ate.
async function marcarTestador(req, token) {
  if (req.modoQa || !token) return;
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    if (d.type !== 'painel_publico' || !d.associado_id) return;
    const r = await db.query('SELECT 1 FROM sindicato_associados WHERE id = $1 AND ativo AND testador_ate > NOW()', [d.associado_id]);
    if (r.rows[0]) { req.modoQa = true; req.modoQaMotivo = 'testador'; }
  } catch { /* token inválido/velho: segue como visitante */ }
}

const bearer = req => (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

const lerAdminOpcional = async (req, res, next) => {
  await marcarModoQa(req, bearer(req));
  // páginas públicas: o site manda a sessão do cliente em x-cliente-token
  await marcarTestador(req, String(req.headers['x-cliente-token'] || '') || null);
  next();
};

// Mesmo "olho de admin", mas com o JWT do admin no header x-admin-token —
// pra rotas em que o Authorization já é a sessão do CLIENTE (pedido pelo
// site: o admin testa comprando da empresa de teste logado como cliente).
// Testador: a própria sessão do cliente (Authorization) liga o modo QA.
const lerAdminOpcionalCabecalho = async (req, res, next) => {
  await marcarModoQa(req, String(req.headers['x-admin-token'] || '') || null);
  await marcarTestador(req, bearer(req));
  next();
};

module.exports = { authenticate, requireAdmin, requireEquipe, requireInternal, requireAdminUniversidade, requireMovvPartner, lerAdminOpcional, lerAdminOpcionalCabecalho };

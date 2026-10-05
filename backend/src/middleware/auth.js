const jwt = require('jsonwebtoken');
const db = require('../config/database');

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
        'SELECT id, name, email, role, whatsapp, pix_key, base_salary FROM internal_collaborators WHERE id = $1 AND active = true',
        [decoded.id]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Colaborador não encontrado ou inativo' });
      }
      req.user = { ...result.rows[0], type: 'internal', is_admin: false };
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
        'SELECT id, code, name, email, type, is_admin, is_active, parent_id FROM partners WHERE id = $1',
        [decoded.id]
      );
      if (!result.rows[0] || !result.rows[0].is_active) {
        return res.status(401).json({ error: 'Parceiro não encontrado ou inativo' });
      }
      req.user = result.rows[0];
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
    const r = await db.query('SELECT is_admin, is_active FROM partners WHERE id = $1', [decoded.id]);
    req.modoQa = Boolean(r.rows[0]?.is_admin && r.rows[0]?.is_active);
    req.modoQaMotivo = req.modoQa ? 'ok' : 'nao_admin';
  } catch (err) {
    req.modoQaMotivo = err.name === 'TokenExpiredError' ? 'login_expirado' : 'token_invalido';
  }
}

const lerAdminOpcional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  await marcarModoQa(req, authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
  next();
};

// Mesmo "olho de admin", mas com o JWT do admin no header x-admin-token —
// pra rotas em que o Authorization já é a sessão do CLIENTE (pedido pelo
// site: o admin testa comprando da empresa de teste logado como cliente).
const lerAdminOpcionalCabecalho = async (req, res, next) => {
  await marcarModoQa(req, String(req.headers['x-admin-token'] || '') || null);
  next();
};

module.exports = { authenticate, requireAdmin, requireInternal, lerAdminOpcional, lerAdminOpcionalCabecalho };

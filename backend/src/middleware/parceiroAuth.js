const jwt = require('jsonwebtoken');
const db = require('../config/database');

const TIPO = 'parceiro';
const EXPIRA_EM = '24h';

function gerarTokenParceiro({ parceiroId, usuarioId, cargo }) {
  return jwt.sign(
    { parceiro_id: parceiroId, usuario_id: usuarioId, cargo, type: TIPO },
    process.env.JWT_SECRET,
    { expiresIn: EXPIRA_EM }
  );
}

// Sessão do Portal do Parceiro — JWT próprio (não o mesmo de
// internal/indicator/partners, ver authenticate() em middleware/auth.js).
// Injeta req.parceiro (o comércio) e req.parceiroUsuario (quem logou).
async function authenticateParceiro(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessão expirada, faça login novamente' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== TIPO) return res.status(401).json({ error: 'Sessão inválida' });

    const usuarioResult = await db.query(
      'SELECT id, parceiro_id, email, cargo, ativo FROM sindicato_parceiro_usuarios WHERE id = $1',
      [decoded.usuario_id]
    );
    const usuario = usuarioResult.rows[0];
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const parceiroResult = await db.query(
      'SELECT id, slug, nome, logo_url, status, plano FROM sindicato_parceiros WHERE id = $1',
      [usuario.parceiro_id]
    );
    const parceiro = parceiroResult.rows[0];
    if (!parceiro) return res.status(401).json({ error: 'Parceiro não encontrado' });

    if (parceiro.status !== 'ativo') {
      return res.status(403).json({ error: 'Sua loja está inativa no momento. Fale com o Sindicato pra reativar o acesso.' });
    }

    req.parceiro = parceiro;
    req.parceiroUsuario = { id: usuario.id, cargo: usuario.cargo, email: usuario.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada, faça login novamente' });
  }
}

module.exports = { gerarTokenParceiro, authenticateParceiro };

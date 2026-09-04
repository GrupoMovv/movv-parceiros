const jwt = require('jsonwebtoken');
const db = require('../config/database');

const TIPO = 'painel_publico';
// 30 dias — essa sessão também é a "sessão do associado" no Marketplace
// (login automático via ?associado=hash ou manual por CPF+nascimento), não
// só o "Meu Painel". Precisa sobreviver a vários dias de navegação, não só
// uma visita.
const EXPIRA_EM = '30d';

function gerarTokenPainel(associadoId) {
  return jwt.sign({ associado_id: associadoId, type: TIPO }, process.env.JWT_SECRET, { expiresIn: EXPIRA_EM });
}

// Sessão pública (30 dias) pro "Meu Painel" e pro Marketplace — não é o
// mesmo JWT dos usuários internos/parceiros (não tem is_admin, role etc.),
// só carrega o id do associado. authenticate() padrão não serve aqui porque
// essa sessão nasce de CPF + data de nascimento (ou do hash da carteirinha),
// não de partners/internal_collaborators.
async function authenticatePainelPublico(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessão expirada, faça login novamente' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== TIPO) return res.status(401).json({ error: 'Sessão inválida' });

    const result = await db.query('SELECT * FROM sindicato_associados WHERE id = $1', [decoded.associado_id]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Cadastro não encontrado' });

    req.painelAssociado = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada, faça login novamente' });
  }
}

module.exports = { gerarTokenPainel, authenticatePainelPublico };

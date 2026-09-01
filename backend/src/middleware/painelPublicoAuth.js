const jwt = require('jsonwebtoken');
const db = require('../config/database');

const TIPO = 'painel_publico';
const EXPIRA_EM = '1h';

function gerarTokenPainel(associadoId) {
  return jwt.sign({ associado_id: associadoId, type: TIPO }, process.env.JWT_SECRET, { expiresIn: EXPIRA_EM });
}

// Sessão pública curta (1h) pro "Meu Painel" — não é o mesmo JWT dos
// usuários internos/parceiros (não tem is_admin, role etc.), só carrega o
// id do associado. authenticate() padrão não serve aqui porque essa sessão
// nasce de CPF + data de nascimento, não de partners/internal_collaborators.
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

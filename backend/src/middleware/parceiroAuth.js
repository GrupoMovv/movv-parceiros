const jwt = require('jsonwebtoken');
const db = require('../config/database');

const TIPO = 'parceiro';
const EXPIRA_EM = '24h';
// 'pausado' é reversível pelo próprio parceiro (Zona de Perigo das
// Configurações) — precisa continuar logando pra poder reativar sozinho.
// 'em_verificacao' = vendedor pessoa física esperando o admin conferir o
// documento (migration 076): entra no painel e monta anúncios, mas não
// aparece em nada público (as listagens exigem 'ativo').
const STATUS_PERMITEM_LOGIN = ['ativo', 'pausado', 'em_verificacao', 'aguardando_plano'];

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
      // pet_servicos: aba "🐾 Agendamentos" (e_pet_atendimento no /me) e as
      // regras de fidelidade do Pet — sem ele o menu do pet shop some.
      // tipo_pessoa/nivel_vendedor/identidade_status: vendedor pessoa física
      // (migration 076) — produto de CPF entra em moderação.
      'SELECT id, slug, nome, logo_url, status, plano, e_pioneiro, created_at, plano_iniciado_em, categorias, plano_expira_em, cortesia_interna, pet_servicos, tipo_pessoa, nivel_vendedor, e_mei, identidade_status FROM sindicato_parceiros WHERE id = $1',
      [usuario.parceiro_id]
    );
    const parceiro = parceiroResult.rows[0];
    if (!parceiro) return res.status(401).json({ error: 'Parceiro não encontrado' });

    if (!STATUS_PERMITEM_LOGIN.includes(parceiro.status)) {
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

const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../config/database');
const { gerarTokenParceiro } = require('../middleware/parceiroAuth');
const { enviarRecuperacaoSenhaParceiro } = require('../services/emailService');

const RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000; // 1h

function parceiroPublico(p) {
  return { id: p.id, nome: p.nome, slug: p.slug, logo_url: p.logo_url, status: p.status };
}

async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const usuarioResult = await db.query(
      'SELECT * FROM sindicato_parceiro_usuarios WHERE email = $1',
      [email]
    );
    const usuario = usuarioResult.rows[0];
    // Mesma mensagem genérica pra email inexistente e senha errada — não dá
    // pra um atacante descobrir por tentativa quais emails estão cadastrados.
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaConfere) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const parceiroResult = await db.query('SELECT * FROM sindicato_parceiros WHERE id = $1', [usuario.parceiro_id]);
    const parceiro = parceiroResult.rows[0];
    if (!parceiro || parceiro.status !== 'ativo') {
      return res.status(403).json({ error: 'Sua loja está inativa no momento. Fale com o Sindicato pra reativar o acesso.' });
    }

    await db.query('UPDATE sindicato_parceiro_usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id]);

    const token = gerarTokenParceiro({ parceiroId: parceiro.id, usuarioId: usuario.id, cargo: usuario.cargo });

    return res.json({
      token,
      parceiro: parceiroPublico(parceiro),
      usuario: { id: usuario.id, email: usuario.email, cargo: usuario.cargo },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

// JWT é stateless — não existe sessão pra invalidar no servidor. O token
// expira sozinho em 24h; o front descarta o token guardado no localStorage.
async function logout(req, res) {
  return res.json({ ok: true });
}

async function me(req, res) {
  return res.json({ parceiro: req.parceiro, usuario: req.parceiroUsuario });
}

async function esqueciSenha(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

    const usuarioResult = await db.query(
      `SELECT u.*, p.nome AS parceiro_nome FROM sindicato_parceiro_usuarios u
       JOIN sindicato_parceiros p ON p.id = u.parceiro_id
       WHERE u.email = $1`,
      [email]
    );
    const usuario = usuarioResult.rows[0];

    // Sempre responde sucesso genérico, exista ou não o email — não revela
    // pra quem está tentando quais contas existem no sistema.
    if (usuario && usuario.ativo) {
      const token = nanoid(32);
      const expiraEm = new Date(Date.now() + RESET_TOKEN_VALIDADE_MS);
      await db.query(
        'UPDATE sindicato_parceiro_usuarios SET reset_token = $1, reset_token_expira_em = $2 WHERE id = $3',
        [token, expiraEm, usuario.id]
      );
      try {
        await enviarRecuperacaoSenhaParceiro({ nome: usuario.parceiro_nome, email: usuario.email, token });
      } catch (emailErr) {
        console.error('[parceiroAuth] Falha ao enviar email de recuperação:', emailErr.message);
      }
    }

    return res.json({ ok: true, mensagem: 'Se o email existir, enviamos um link de redefinição.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
}

async function redefinirSenha(req, res) {
  try {
    const token = String(req.body.token || '').trim();
    const novaSenha = String(req.body.nova_senha || '');
    if (!token || !novaSenha) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }
    if (novaSenha.length < 8) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres' });
    }

    const usuarioResult = await db.query(
      'SELECT * FROM sindicato_parceiro_usuarios WHERE reset_token = $1',
      [token]
    );
    const usuario = usuarioResult.rows[0];
    if (!usuario || !usuario.reset_token_expira_em || new Date(usuario.reset_token_expira_em) < new Date()) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite uma nova redefinição.' });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await db.query(
      'UPDATE sindicato_parceiro_usuarios SET senha_hash = $1, reset_token = NULL, reset_token_expira_em = NULL WHERE id = $2',
      [senhaHash, usuario.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
}

module.exports = { login, logout, me, esqueciSenha, redefinirSenha };

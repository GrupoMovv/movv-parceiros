const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const emailService = require('../services/emailService');

const JANELA_RATE_LIMIT_SENHA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS_SENHA = 3;
const ESPERA_EXCLUSAO_MS = 24 * 60 * 60 * 1000;
const VALIDADE_TOKEN_EXCLUSAO_MS = 7 * 24 * 60 * 60 * 1000;
const VALIDADE_EMAIL_PENDENTE_MS = 24 * 60 * 60 * 1000;

const PREFERENCIAS_PADRAO = {
  novos_clientes_whatsapp: true,
  resumo_semanal_email: true,
  novidades_iub_email: true,
  promocoes_expirando_whatsapp: true,
};

const CARGOS_VALIDOS = ['dono', 'gerente', 'socio', 'atendente', 'outro'];

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

async function registrarAuditoria(parceiroId, usuarioId, acao, detalhes, req) {
  try {
    await db.query(
      `INSERT INTO sindicato_parceiro_auditoria (parceiro_id, usuario_id, acao, detalhes, ip_origem)
       VALUES ($1, $2, $3, $4, $5)`,
      [parceiroId, usuarioId || null, acao, detalhes ? JSON.stringify(detalhes) : null, req ? getIp(req) : null]
    );
  } catch (err) {
    console.error('[auditoria] falha ao registrar (ignorado):', err.message);
  }
}

// GET /api/parceiro/conta — dados que não vêm no /parceiro/auth/me (esse é
// sobre o parceiro/comércio; este aqui é sobre quem tá logado + preferências).
async function obterConta(req, res) {
  try {
    const usuarioResult = await db.query(
      'SELECT nome, email, email_pendente, cargo, whatsapp_pessoal FROM sindicato_parceiro_usuarios WHERE id = $1',
      [req.parceiroUsuario.id]
    );
    const parceiroResult = await db.query(
      'SELECT preferencias_notificacao FROM sindicato_parceiros WHERE id = $1',
      [req.parceiro.id]
    );
    return res.json({
      ...usuarioResult.rows[0],
      preferencias_notificacao: { ...PREFERENCIAS_PADRAO, ...(parceiroResult.rows[0]?.preferencias_notificacao || {}) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar dados da conta' });
  }
}

// PUT /api/parceiro/auth/senha
function senhaForte(senha) {
  return senha.length >= 8 && /[a-zA-Z]/.test(senha) && /[0-9]/.test(senha);
}

async function alterarSenha(req, res) {
  const senhaAtual = String(req.body.senha_atual || '');
  const senhaNova = String(req.body.senha_nova || '');

  if (!senhaAtual || !senhaNova) return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
  if (!senhaForte(senhaNova)) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres, com letra e número' });
  if (senhaAtual === senhaNova) return res.status(400).json({ error: 'A nova senha precisa ser diferente da atual' });

  try {
    const usuarioResult = await db.query(
      'SELECT senha_hash, tentativas_senha, ultima_tentativa_senha FROM sindicato_parceiro_usuarios WHERE id = $1',
      [req.parceiroUsuario.id]
    );
    const usuario = usuarioResult.rows[0];

    const dentroDaJanela = usuario.ultima_tentativa_senha
      && (Date.now() - new Date(usuario.ultima_tentativa_senha).getTime() < JANELA_RATE_LIMIT_SENHA_MS);
    const tentativasAtuais = dentroDaJanela ? usuario.tentativas_senha : 0;

    if (dentroDaJanela && tentativasAtuais >= MAX_TENTATIVAS_SENHA) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }

    const senhaConfere = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaConfere) {
      await db.query(
        'UPDATE sindicato_parceiro_usuarios SET tentativas_senha = $1, ultima_tentativa_senha = NOW() WHERE id = $2',
        [tentativasAtuais + 1, req.parceiroUsuario.id]
      );
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(senhaNova, 10);
    await db.query(
      'UPDATE sindicato_parceiro_usuarios SET senha_hash = $1, tentativas_senha = 0, ultima_tentativa_senha = NULL WHERE id = $2',
      [senhaHash, req.parceiroUsuario.id]
    );

    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'senha_alterada', null, req);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar senha' });
  }
}

// PUT /api/parceiro/notificacoes
async function atualizarNotificacoes(req, res) {
  const chaves = Object.keys(PREFERENCIAS_PADRAO);
  const entrada = req.body?.preferencias || {};
  const preferencias = {};
  for (const chave of chaves) {
    preferencias[chave] = entrada[chave] === true;
  }

  try {
    await db.query(
      'UPDATE sindicato_parceiros SET preferencias_notificacao = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(preferencias), req.parceiro.id]
    );
    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'notificacoes_atualizadas', preferencias, req);
    return res.json({ preferencias_notificacao: preferencias });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar preferências' });
  }
}

function sanitizeText(v, maxLen) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, maxLen) : null;
}

// PUT /api/parceiro/dados-conta
async function atualizarDadosConta(req, res) {
  const nome = sanitizeText(req.body.nome, 160);
  const emailNovo = String(req.body.email || '').trim().toLowerCase();
  const cargo = req.body.cargo;
  const whatsappPessoal = String(req.body.whatsapp_pessoal || '').replace(/\D/g, '');

  if (!nome || nome.length < 3) return res.status(400).json({ error: 'Nome precisa ter pelo menos 3 caracteres' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNovo)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!CARGOS_VALIDOS.includes(cargo)) return res.status(400).json({ error: 'Cargo inválido' });
  if (whatsappPessoal && (whatsappPessoal.length < 10 || whatsappPessoal.length > 11)) {
    return res.status(400).json({ error: 'WhatsApp inválido' });
  }

  try {
    const usuarioAtual = (await db.query('SELECT email FROM sindicato_parceiro_usuarios WHERE id = $1', [req.parceiroUsuario.id])).rows[0];
    const emailMudou = emailNovo !== usuarioAtual.email;

    if (emailMudou) {
      const emEuso = await db.query('SELECT 1 FROM sindicato_parceiro_usuarios WHERE email = $1 AND id != $2', [emailNovo, req.parceiroUsuario.id]);
      if (emEuso.rows[0]) return res.status(409).json({ error: 'Este e-mail já está em uso' });
    }

    const token = emailMudou ? nanoid(32) : null;
    const expiraEm = emailMudou ? new Date(Date.now() + VALIDADE_EMAIL_PENDENTE_MS) : null;

    await db.query(
      `UPDATE sindicato_parceiro_usuarios SET
         nome = $1, cargo = $2, whatsapp_pessoal = $3,
         email_pendente = $4, email_pendente_token = $5, email_pendente_expira_em = $6
       WHERE id = $7`,
      [nome, cargo, whatsappPessoal || null, emailMudou ? emailNovo : null, token, expiraEm, req.parceiroUsuario.id]
    );

    if (emailMudou) {
      emailService.enviarConfirmacaoEmailParceiro({ nome, emailNovo, token })
        .catch(err => console.error('[EMAIL]', err.message));
    }

    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'dados_conta_atualizados', { nome, cargo, email_pendente: emailMudou ? emailNovo : undefined }, req);

    return res.json({ ok: true, email_pendente: emailMudou ? emailNovo : null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar dados da conta' });
  }
}

// POST /api/public/parceiro/confirmar-email — clicado a partir do link do
// e-mail, sem sessão (mesmo padrão do reset de senha).
async function confirmarEmailPendente(req, res) {
  const token = String(req.body.token || req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token é obrigatório' });

  try {
    const usuarioResult = await db.query(
      'SELECT id, email_pendente, email_pendente_expira_em FROM sindicato_parceiro_usuarios WHERE email_pendente_token = $1',
      [token]
    );
    const usuario = usuarioResult.rows[0];
    if (!usuario || !usuario.email_pendente_expira_em || new Date(usuario.email_pendente_expira_em) < new Date()) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite a troca de e-mail novamente.' });
    }

    await db.query(
      `UPDATE sindicato_parceiro_usuarios
       SET email = $1, email_pendente = NULL, email_pendente_token = NULL, email_pendente_expira_em = NULL
       WHERE id = $2`,
      [usuario.email_pendente, usuario.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao confirmar e-mail' });
  }
}

async function verificarSenhaAtual(usuarioId, senha) {
  const r = await db.query('SELECT senha_hash FROM sindicato_parceiro_usuarios WHERE id = $1', [usuarioId]);
  if (!r.rows[0]) return false;
  return bcrypt.compare(String(senha || ''), r.rows[0].senha_hash);
}

// POST /api/parceiro/conta/pausar
async function pausarConta(req, res) {
  try {
    const senhaOk = await verificarSenhaAtual(req.parceiroUsuario.id, req.body.senha);
    if (!senhaOk) return res.status(401).json({ error: 'Senha incorreta' });

    await db.query('UPDATE sindicato_parceiros SET status = $1, updated_at = NOW() WHERE id = $2', ['pausado', req.parceiro.id]);
    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'conta_pausada', null, req);
    return res.json({ ok: true, status: 'pausado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao pausar conta' });
  }
}

// POST /api/parceiro/conta/reativar — sem senha: reverter uma pausa é a
// direção segura, não precisa da mesma fricção de quem tá desativando.
async function reativarConta(req, res) {
  try {
    await db.query('UPDATE sindicato_parceiros SET status = $1, updated_at = NOW() WHERE id = $2', ['ativo', req.parceiro.id]);
    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'conta_reativada', null, req);
    return res.json({ ok: true, status: 'ativo' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reativar conta' });
  }
}

// POST /api/parceiro/conta/solicitar-exclusao
async function solicitarExclusao(req, res) {
  try {
    const senhaOk = await verificarSenhaAtual(req.parceiroUsuario.id, req.body.senha);
    if (!senhaOk) return res.status(401).json({ error: 'Senha incorreta' });

    const token = nanoid(32);
    await db.query(
      'UPDATE sindicato_parceiros SET exclusao_token = $1, exclusao_solicitada_em = NOW() WHERE id = $2',
      [token, req.parceiro.id]
    );

    emailService.enviarConfirmacaoExclusaoParceiro({
      nome: req.parceiroUsuario.email.split('@')[0], nomeFantasia: req.parceiro.nome, email: req.parceiroUsuario.email, token,
    }).catch(err => console.error('[EMAIL]', err.message));

    await registrarAuditoria(req.parceiro.id, req.parceiroUsuario.id, 'exclusao_solicitada', null, req);
    return res.json({ ok: true, message: 'Enviamos um e-mail de confirmação. O link só funciona depois de 24h, por segurança.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao solicitar exclusão' });
  }
}

// POST /api/public/parceiro/confirmar-exclusao — sem sessão (link de
// e-mail). Não existe job agendado nesse projeto: o próprio clique, feito
// tarde o bastante (>= 24h da solicitação), é quem efetiva a exclusão.
async function confirmarExclusao(req, res) {
  const token = String(req.body.token || req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token é obrigatório' });

  try {
    const parceiroResult = await db.query(
      'SELECT * FROM sindicato_parceiros WHERE exclusao_token = $1',
      [token]
    );
    const parceiro = parceiroResult.rows[0];
    if (!parceiro || !parceiro.exclusao_solicitada_em) {
      return res.status(400).json({ error: 'Link inválido.' });
    }

    const decorridoMs = Date.now() - new Date(parceiro.exclusao_solicitada_em).getTime();
    if (decorridoMs > VALIDADE_TOKEN_EXCLUSAO_MS) {
      return res.status(400).json({ error: 'Link expirado. Solicite a exclusão novamente pelo painel.' });
    }
    if (decorridoMs < ESPERA_EXCLUSAO_MS) {
      const liberaEm = new Date(new Date(parceiro.exclusao_solicitada_em).getTime() + ESPERA_EXCLUSAO_MS);
      return res.status(400).json({
        error: `Por segurança, ainda faltam algumas horas. Esse link libera às ${liberaEm.toLocaleString('pt-BR')}.`,
      });
    }

    // Junta os public_id do Cloudinary ANTES de apagar do banco (depois
    // que a linha some, essas referências somem junto).
    const produtos = (await db.query('SELECT fotos FROM sindicato_parceiro_produtos WHERE parceiro_id = $1', [parceiro.id])).rows;
    const promocoes = (await db.query('SELECT foto_public_id FROM sindicato_parceiro_promocoes WHERE parceiro_id = $1', [parceiro.id])).rows;

    const publicIds = [];
    if (parceiro.logo_public_id) publicIds.push(parceiro.logo_public_id);
    for (const foto of parceiro.fotos_estabelecimento || []) if (foto.publicId) publicIds.push(foto.publicId);
    for (const produto of produtos) for (const foto of produto.fotos || []) if (foto.publicId) publicIds.push(foto.publicId);
    for (const promocao of promocoes) if (promocao.foto_public_id) publicIds.push(promocao.foto_public_id);

    // sem FK: sobrevive à exclusão cascateada da própria linha que registra.
    await registrarAuditoria(parceiro.id, null, 'conta_excluida', { nome: parceiro.nome, cnpj: parceiro.cnpj }, req);

    await db.query('DELETE FROM sindicato_parceiros WHERE id = $1', [parceiro.id]);

    for (const publicId of publicIds) await cloudinaryService.deletarFoto(publicId);

    return res.json({ ok: true, message: 'Conta excluída permanentemente.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao confirmar exclusão' });
  }
}

module.exports = {
  obterConta,
  alterarSenha,
  atualizarNotificacoes,
  atualizarDadosConta,
  confirmarEmailPendente,
  pausarConta,
  reativarConta,
  solicitarExclusao,
  confirmarExclusao,
};

const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../config/database');
const { gerarTokenParceiro } = require('../middleware/parceiroAuth');
const { enviarRecuperacaoSenhaParceiro } = require('../services/emailService');
const { planoEfetivo } = require('../config/planos');
const { ehRestaurante, ehBebidas } = require('../utils/categorias');
const { SERVICOS_PET } = require('../config/pet');
const { limiteProdutosAtivosPf } = require('../config/vendedorPf');

const RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000; // 1h

// 'pausado' é reversível pelo próprio parceiro (Zona de Perigo das
// Configurações) — precisa continuar conseguindo logar pra poder reativar.
// Qualquer outro status (ex.: bloqueado pelo Sindicato) barra o login mesmo.
// 'em_verificacao' = pessoa física esperando conferência do documento
// (migration 076). Mesma lista do middleware/parceiroAuth.js.
const { pedidosSiteLiberado } = require('../config/pedidos');

const STATUS_PERMITEM_LOGIN = ['ativo', 'pausado', 'em_verificacao', 'aguardando_plano'];

// `plano` aqui já é o EFETIVO (aplica o seed de demonstração por cima do
// plano real) — front nunca precisa saber da lista de seed, só lê
// parceiro.plano e confia. Endpoints que enforçam limite continuam usando
// planoEfetivo(req.parceiro) direto a partir do dado cru do banco.
function parceiroPublico(p) {
  return { id: p.id, nome: p.nome, slug: p.slug, cnpj: p.cnpj, logo_url: p.logo_url, status: p.status, plano: planoEfetivo(p), e_pioneiro: p.e_pioneiro, created_at: p.created_at, e_restaurante: ehRestaurante(p.categorias), e_bebidas: ehBebidas(p.categorias),
    // aba "🐾 Agendamentos" do painel: quem atende pet (banho, veterinária...)
    e_pet_atendimento: (p.pet_servicos || []).some(c => SERVICOS_PET.find(s => s.codigo === c)?.natureza === 'servico'),
    // vendedor pessoa física (migration 076): painel mostra "Em verificação"
    tipo_pessoa: p.tipo_pessoa || 'pj', nivel_vendedor: p.nivel_vendedor || 'comercial', e_mei: Boolean(p.e_mei),
    identidade_status: p.identidade_status || null,
    // limite de produtos ATIVOS do PF (Casual 10 / Empreendedor 30) — fonte: config/planos.js
    limite_produtos_ativos_pf: limiteProdutosAtivosPf(p),
    // aba "🛒 Pedidos pelo site" (config/pedidos.js: só empresa de teste até o lançamento)
    pedidos_site_liberado: pedidosSiteLiberado(p) };
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
    if (!parceiro || !STATUS_PERMITEM_LOGIN.includes(parceiro.status)) {
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
  const parceiro = parceiroPublico(req.parceiro);
  // Também é "de bebidas" quem entrou no Disk Bebidas pela aba do painel
  // (sem ter escolhido o segmento no /vender) — ProdutoForm mostra o aviso.
  let temCadastroBeer = false;
  try {
    const r = await db.query('SELECT ativo FROM beer_estabelecimentos WHERE parceiro_id = $1', [req.parceiro.id]);
    temCadastroBeer = r.rows.length > 0;
    if (!parceiro.e_bebidas) parceiro.e_bebidas = r.rows.some(x => x.ativo);
  } catch { /* aviso é só UX — a trava de verdade é no salvar */ }
  // Aba "Meu IUB Beer" (Junior, 08/10): só pra quem é do ramo (categoria
  // Bebidas ou Alimentação) ou já tem cadastro no Disk Bebidas, ativo ou não.
  // As outras lojas ativam pelo link em Configurações.
  parceiro.beer_disponivel = Boolean(parceiro.e_bebidas || parceiro.e_restaurante || temCadastroBeer);
  return res.json({ parceiro, usuario: req.parceiroUsuario });
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

module.exports = { login, logout, me, esqueciSenha, redefinirSenha, parceiroPublico, STATUS_PERMITEM_LOGIN };

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');

const MAX_SOLICITACOES_POR_IP_24H = 3;

// Mesmo mapeamento do card de segmento na Tela 2 do /vender — usado só pra
// dar um ícone/cor padrão ao parceiro quando a solicitação é aprovada (o
// parceiro pode trocar depois pelo próprio painel, quando existir essa tela).
const SEGMENTOS = {
  produtos:     { label: 'Produtos',     icone: '🛍️', cor: '#8B5CF6' },
  servicos:     { label: 'Serviços',     icone: '🔧', cor: '#0EA5E9' },
  alimentacao:  { label: 'Alimentação',  icone: '🍔', cor: '#F97316' },
  hospedagem:   { label: 'Hospedagem',   icone: '🏨', cor: '#10B981' },
  outro:        { label: 'Outro',        icone: '🎯', cor: '#64748B' },
};

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

function normalizarEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function whatsappValido(v) {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
}

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

function normalizarTexto(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function gerarSlugUnico(nome) {
  const base = normalizarTexto(nome).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    || 'parceiro';

  let slug = base;
  let sufixo = 2;
  while (true) { // eslint-disable-line no-constant-condition
    const existe = await db.query('SELECT 1 FROM sindicato_parceiros WHERE slug = $1', [slug]);
    if (!existe.rows[0]) return slug;
    slug = `${base}-${sufixo}`;
    sufixo += 1;
  }
}

function linkWhatsappComTexto(numero, mensagem) {
  const digits = onlyDigits(numero);
  return `https://api.whatsapp.com/send?phone=55${digits}&text=${encodeURIComponent(mensagem)}`;
}

// POST /api/public/vender/verificar-cnpj — público, checagem rápida antes
// do usuário preencher o resto do formulário.
async function verificarCnpj(req, res) {
  const cnpj = onlyDigits(req.body.cnpj);
  if (!isValidCNPJ(cnpj)) {
    return res.json({ disponivel: false, motivo: 'CNPJ inválido' });
  }
  try {
    const jaParceiro = await db.query('SELECT 1 FROM sindicato_parceiros WHERE cnpj = $1', [cnpj]);
    if (jaParceiro.rows[0]) {
      return res.json({ disponivel: false, motivo: 'Este CNPJ já está cadastrado como parceiro' });
    }
    const pendente = await db.query(
      `SELECT 1 FROM sindicato_parceiros_solicitacoes WHERE cnpj = $1 AND status = 'pendente'`,
      [cnpj]
    );
    if (pendente.rows[0]) {
      return res.json({ disponivel: false, motivo: 'Já existe uma solicitação pendente com este CNPJ' });
    }
    return res.json({ disponivel: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar CNPJ' });
  }
}

// POST /api/public/vender/solicitacao — público, cria a solicitação em
// análise. Não cria login nenhum ainda — isso só acontece na aprovação.
async function criarSolicitacao(req, res) {
  const b = req.body || {};
  const cnpj = onlyDigits(b.cnpj);
  const responsavelCpf = onlyDigits(b.responsavel_cpf);
  const email = normalizarEmail(b.email);
  const whatsapp = onlyDigits(b.whatsapp);
  const segmento = String(b.segmento || '');

  if (!SEGMENTOS[segmento]) return res.status(400).json({ error: 'Segmento inválido' });
  if (!b.nome_fantasia?.trim()) return res.status(400).json({ error: 'Nome fantasia é obrigatório' });
  if (!isValidCNPJ(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });
  if (!b.endereco?.trim() || !b.bairro?.trim()) return res.status(400).json({ error: 'Endereço e bairro são obrigatórios' });
  if (!whatsappValido(whatsapp)) return res.status(400).json({ error: 'WhatsApp inválido' });
  if (!emailValido(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!b.responsavel_nome?.trim()) return res.status(400).json({ error: 'Nome do responsável é obrigatório' });
  if (!isValidCPF(responsavelCpf)) return res.status(400).json({ error: 'CPF do responsável inválido' });
  if (!b.termos_aceitos) return res.status(400).json({ error: 'É preciso aceitar os termos de uso' });

  const ip = getIp(req);

  try {
    if (ip) {
      const recentes = await db.query(
        `SELECT COUNT(*)::int AS total FROM sindicato_parceiros_solicitacoes
         WHERE termos_ip = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [ip]
      );
      if (recentes.rows[0].total >= MAX_SOLICITACOES_POR_IP_24H) {
        return res.status(429).json({ error: 'Limite de solicitações atingido. Tente novamente em algumas horas.' });
      }
    }

    const cnpjEmUso = await db.query('SELECT 1 FROM sindicato_parceiros WHERE cnpj = $1', [cnpj]);
    if (cnpjEmUso.rows[0]) return res.status(409).json({ error: 'Este CNPJ já está cadastrado como parceiro' });

    const cnpjPendente = await db.query(
      `SELECT 1 FROM sindicato_parceiros_solicitacoes WHERE cnpj = $1 AND status = 'pendente'`, [cnpj]
    );
    if (cnpjPendente.rows[0]) return res.status(409).json({ error: 'Já existe uma solicitação pendente com este CNPJ' });

    const emailEmUso = await db.query('SELECT 1 FROM sindicato_parceiro_usuarios WHERE email = $1', [email]);
    if (emailEmUso.rows[0]) return res.status(409).json({ error: 'Este e-mail já está em uso' });

    const emailPendente = await db.query(
      `SELECT 1 FROM sindicato_parceiros_solicitacoes WHERE email = $1 AND status = 'pendente'`, [email]
    );
    if (emailPendente.rows[0]) return res.status(409).json({ error: 'Já existe uma solicitação pendente com este e-mail' });

    const result = await db.query(
      `INSERT INTO sindicato_parceiros_solicitacoes
        (segmento, nome_fantasia, razao_social, cnpj, categoria_principal, descricao_curta,
         endereco, bairro, cidade, estado, whatsapp, email, instagram,
         responsavel_nome, responsavel_cpf, responsavel_cargo, termos_aceitos_em, termos_ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17)
       RETURNING id`,
      [
        segmento, b.nome_fantasia.trim(), b.razao_social?.trim() || null, cnpj,
        b.categoria_principal?.trim() || null, b.descricao_curta?.trim() || null,
        b.endereco.trim(), b.bairro.trim(), b.cidade?.trim() || 'Itumbiara', b.estado?.trim() || 'GO',
        whatsapp, email, b.instagram?.trim() || null,
        b.responsavel_nome.trim(), responsavelCpf, b.responsavel_cargo?.trim() || null, ip,
      ]
    );

    emailService.enviarNovaSolicitacaoParceiroAdmin({
      nomeFantasia: b.nome_fantasia.trim(), cnpj, segmento: SEGMENTOS[segmento].label, whatsapp, email,
    }).catch(err => console.error('[EMAIL]', err.message));

    return res.status(201).json({ id: result.rows[0].id, message: 'Cadastro enviado! Você recebe o resultado em até 24h.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar solicitação' });
  }
}

// GET /api/sindicato-parceiros-solicitacoes — admin/sindicato_aprendiz
async function listarSolicitacoes(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const where = [];
    const params = [];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_parceiros_solicitacoes ${whereSql}`, params);

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT * FROM sindicato_parceiros_solicitacoes ${whereSql}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar solicitações' });
  }
}

async function contarPendentes(req, res) {
  try {
    const result = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_parceiros_solicitacoes WHERE status = 'pendente'`);
    return res.json({ pendentes: result.rows[0].total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao contar solicitações' });
  }
}

async function detalheSolicitacao(req, res) {
  try {
    const result = await db.query('SELECT * FROM sindicato_parceiros_solicitacoes WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar solicitação' });
  }
}

// PATCH /api/sindicato-parceiros-solicitacoes/:id/aprovar — admin/sindicato_aprendiz
// Cria o parceiro + o login, gera senha aleatória e manda email com as
// credenciais. O link/texto de WhatsApp volta pronto na resposta pro admin
// mandar manualmente (não existe integração de envio automático de WhatsApp
// no sistema — mesmo padrão usado em Carteirinhas/Sindicato).
async function aprovarSolicitacao(req, res) {
  try {
    const solResult = await db.query('SELECT * FROM sindicato_parceiros_solicitacoes WHERE id = $1', [req.params.id]);
    const sol = solResult.rows[0];
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' });
    if (sol.status !== 'pendente') return res.status(409).json({ error: `Solicitação já está ${sol.status}` });

    const seg = SEGMENTOS[sol.segmento] || SEGMENTOS.outro;
    const slug = await gerarSlugUnico(sol.nome_fantasia);
    const categorias = [seg.label, sol.categoria_principal].filter(Boolean);
    const senha = gerarSenha();
    const senhaHash = await bcrypt.hash(senha, 10);
    const aprovadoPor = req.user?.email || req.user?.name || 'admin';

    let parceiro;
    try {
      await db.query('BEGIN');

      const parceiroResult = await db.query(
        `INSERT INTO sindicato_parceiros
          (slug, nome, razao_social, cnpj, categorias, categoria_principal, icone, cor_icone,
           descricao_completa, endereco, bairro, cidade, estado, whatsapp, instagram, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'ativo')
         RETURNING *`,
        [
          slug, sol.nome_fantasia, sol.razao_social, sol.cnpj, categorias, sol.categoria_principal,
          seg.icone, seg.cor, sol.descricao_curta, sol.endereco, sol.bairro, sol.cidade, sol.estado,
          sol.whatsapp, sol.instagram,
        ]
      );
      parceiro = parceiroResult.rows[0];

      await db.query(
        `INSERT INTO sindicato_parceiro_usuarios (parceiro_id, email, senha_hash, cargo, ativo)
         VALUES ($1,$2,$3,$4,true)`,
        [parceiro.id, sol.email, senhaHash, sol.responsavel_cargo || 'dono']
      );

      await db.query(
        `UPDATE sindicato_parceiros_solicitacoes
         SET status = 'aprovado', aprovado_em = NOW(), aprovado_por = $1, parceiro_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [aprovadoPor, parceiro.id, sol.id]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    emailService.enviarAprovacaoParceiro({
      nome: sol.responsavel_nome, nomeFantasia: sol.nome_fantasia, email: sol.email, senha,
    }).catch(err => console.error('[EMAIL]', err.message));

    const mensagemWhatsapp = `🎉 Olá ${sol.responsavel_nome.split(' ')[0]}! Sua loja foi APROVADA no IUB MAIS!\n\n`
      + `Já pode começar a anunciar seus produtos.\n\n`
      + `🔗 Link: portal.grupomovv.com.br/parceiro/login\n`
      + `📧 Email: ${sol.email}\n`
      + `🔑 Senha: ${senha}\n\n`
      + `Dúvidas? Só chamar aqui.\nIUB MAIS`;

    return res.json({
      parceiro,
      email: sol.email,
      plain_password: senha,
      whatsapp_link: linkWhatsappComTexto(sol.whatsapp, mensagemWhatsapp),
      mensagem_whatsapp: mensagemWhatsapp,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um parceiro com esse CNPJ ou slug' });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao aprovar solicitação' });
  }
}

// PATCH /api/sindicato-parceiros-solicitacoes/:id/rejeitar — admin/sindicato_aprendiz
async function rejeitarSolicitacao(req, res) {
  const { motivo } = req.body;
  try {
    const result = await db.query(
      `UPDATE sindicato_parceiros_solicitacoes
       SET status = 'rejeitado', observacoes_admin = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pendente' RETURNING *`,
      [motivo || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada ou já processada' });
    const sol = result.rows[0];

    emailService.enviarRejeicaoParceiro({
      nome: sol.responsavel_nome, nomeFantasia: sol.nome_fantasia, email: sol.email, motivo,
    }).catch(err => console.error('[EMAIL]', err.message));

    const mensagemWhatsapp = `Olá ${sol.responsavel_nome.split(' ')[0]}, sobre sua solicitação no IUB MAIS: `
      + `por enquanto não conseguimos aprovar seu cadastro.${motivo ? ` Motivo: ${motivo}.` : ''} `
      + `Qualquer dúvida, é só chamar aqui.`;

    return res.json({ solicitacao: sol, whatsapp_link: linkWhatsappComTexto(sol.whatsapp, mensagemWhatsapp) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao rejeitar solicitação' });
  }
}

module.exports = {
  verificarCnpj,
  criarSolicitacao,
  listarSolicitacoes,
  contarPendentes,
  detalheSolicitacao,
  aprovarSolicitacao,
  rejeitarSolicitacao,
};

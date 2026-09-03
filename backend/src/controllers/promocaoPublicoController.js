const db = require('../config/database');

const TIPOS_EVENTO_VALIDOS = ['ver_promocao', 'clique_whatsapp'];
const BACKEND_URL = process.env.BACKEND_URL || 'https://movv-backend.onrender.com';

async function buscarAssociadoIdPorHash(hash) {
  if (!hash) return null;
  const r = await db.query('SELECT id FROM sindicato_associados WHERE carteirinha_hash = $1', [hash]);
  return r.rows[0]?.id || null;
}

async function buscarAssociadoAtivoPorHash(hash) {
  if (!hash) return null;
  const r = await db.query(
    `SELECT nome_completo, codigo_filiado, carteirinha_hash
     FROM sindicato_associados
     WHERE carteirinha_hash = $1 AND ativo = true AND carteirinha_valida_ate >= CURRENT_DATE`,
    [hash]
  );
  return r.rows[0] || null;
}

function formatarPrecoBRL(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function linkWhatsappComTexto(numero, mensagem) {
  const digits = String(numero || '').replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=55${digits}&text=${encodeURIComponent(mensagem)}`;
}

const SELECT_PROMOCAO = `
  pm.id, pm.titulo, pm.descricao, pm.categoria, pm.preco_de, pm.preco_por, pm.preco_associado,
  pm.data_inicio, pm.data_fim, pm.destaque, pm.exclusivo_associado, pm.limite_usos, pm.usos_atuais,
  pm.created_at, pm.produto_id,
  COALESCE(pm.foto_url, pr.fotos->0->>'url') AS foto_url,
  pa.id AS parceiro_id, pa.slug AS parceiro_slug, pa.nome AS parceiro_nome,
  pa.icone AS parceiro_icone, pa.cor_icone AS parceiro_cor_icone, pa.logo_url AS parceiro_logo_url,
  pa.categoria_principal AS parceiro_categoria, pa.endereco AS parceiro_endereco,
  pa.bairro AS parceiro_bairro, pa.cidade AS parceiro_cidade, pa.whatsapp AS parceiro_whatsapp
`;
const FROM_PROMOCAO_ATIVA = `
  FROM sindicato_parceiro_promocoes pm
  JOIN sindicato_parceiros pa ON pa.id = pm.parceiro_id
  LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = pm.produto_id
  WHERE pm.ativo = true AND pm.rascunho = false AND pa.status = 'ativo'
`;

async function getPromocao(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PROMOCAO} ${FROM_PROMOCAO_ATIVA} AND pm.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Promoção não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar promoção' });
  }
}

// Clique no WhatsApp = a pessoa está "reivindicando" a promoção — pra
// promoções com limite de usos, é o sinal mais próximo que temos de uma
// vaga sendo tomada (não existe tela de "marcar como resgatado" ainda).
async function registrarEvento(req, res) {
  try {
    const tipo = TIPOS_EVENTO_VALIDOS.includes(req.body.tipo) ? req.body.tipo : 'ver_promocao';

    const promocao = await db.query('SELECT id, parceiro_id FROM sindicato_parceiro_promocoes WHERE id = $1', [req.params.id]);
    if (!promocao.rows[0]) return res.status(404).json({ error: 'Promoção não encontrada' });

    const associadoId = await buscarAssociadoIdPorHash(req.body.associado_hash);
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    await db.query(
      `INSERT INTO sindicato_parceiro_cliques (parceiro_id, promocao_id, tipo, associado_id, ip_origem, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [promocao.rows[0].parceiro_id, promocao.rows[0].id, tipo, associadoId, ip || null, req.headers['user-agent'] || null]
    );

    if (tipo === 'clique_whatsapp') {
      await db.query(
        `UPDATE sindicato_parceiro_promocoes SET usos_atuais = usos_atuais + 1
         WHERE id = $1 AND limite_usos IS NOT NULL AND usos_atuais < limite_usos`,
        [promocao.rows[0].id]
      );
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar evento' });
  }
}

function montarMensagemWhatsapp(promocao, associado) {
  const temPrecoAssociado = promocao.preco_associado != null;
  const horasRestantes = (new Date(promocao.data_fim) - Date.now()) / 3.6e6;
  const urgente = horasRestantes > 0 && horasRestantes < 24;

  const linhas = [
    urgente ? '🔥 Vi essa promoção no IUB Marketplace e quero garantir antes de acabar!' : 'Olá! Vi essa promoção no IUB Marketplace e tenho interesse.',
    '',
    `🎯 Promoção: ${promocao.titulo}`,
    `💰 De ${formatarPrecoBRL(promocao.preco_de)} por ${formatarPrecoBRL(promocao.preco_por)}`,
  ];

  if (temPrecoAssociado && associado) {
    linhas.push(`💎 Preço Associado: ${formatarPrecoBRL(promocao.preco_associado)}`);
  }

  if (associado) {
    linhas.push('', `📇 Meu nome: ${associado.nome_completo}`, '🎫 Sou associado SECI ativo', `🔗 Minha carteirinha: ${BACKEND_URL}/carteirinha/${associado.carteirinha_hash}`);
  }

  linhas.push('', 'Ainda dá tempo de garantir essa promoção?');

  return linhas.join('\n');
}

async function getMensagemWhatsapp(req, res) {
  try {
    const result = await db.query(
      `SELECT pm.titulo, pm.preco_de, pm.preco_por, pm.preco_associado, pm.data_fim, pa.whatsapp AS parceiro_whatsapp
       ${FROM_PROMOCAO_ATIVA} AND pm.id = $1`,
      [req.params.id]
    );
    const promocao = result.rows[0];
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });
    if (!promocao.parceiro_whatsapp) return res.status(422).json({ error: 'Parceiro sem WhatsApp cadastrado' });

    const associado = await buscarAssociadoAtivoPorHash(req.query.associado);
    const mensagem = montarMensagemWhatsapp(promocao, associado);

    return res.json({
      mensagem,
      whatsapp_numero: promocao.parceiro_whatsapp,
      e_associado_ativo: Boolean(associado),
      url_final: linkWhatsappComTexto(promocao.parceiro_whatsapp, mensagem),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao montar mensagem de WhatsApp' });
  }
}

module.exports = { getPromocao, registrarEvento, getMensagemWhatsapp };

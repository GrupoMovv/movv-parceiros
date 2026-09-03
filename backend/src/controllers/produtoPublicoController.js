const db = require('../config/database');

const TIPOS_EVENTO_VALIDOS = ['ver_produto', 'clique_whatsapp'];
const BACKEND_URL = process.env.BACKEND_URL || 'https://movv-backend.onrender.com';

async function buscarAssociadoIdPorHash(hash) {
  if (!hash) return null;
  const r = await db.query('SELECT id FROM sindicato_associados WHERE carteirinha_hash = $1', [hash]);
  return r.rows[0]?.id || null;
}

// So considera "associado ativo" quem tem cadastro ativo E carteirinha
// dentro da validade - carteirinha vencida cai como visitante comum
// (mesmo criterio das contagens do dashboard de Carteirinhas).
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

// api.whatsapp.com em vez de wa.me: wa.me faz um redirect server-side que
// corrompe emoji (vira U+FFFD) mesmo com encodeURIComponent certo - mesma
// escolha do util equivalente no frontend (utils/carteirinhaWhatsapp.js).
function linkWhatsappComTexto(numero, mensagem) {
  const digits = String(numero || '').replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=55${digits}&text=${encodeURIComponent(mensagem)}`;
}

function montarMensagemWhatsapp(produto, associado) {
  const temPrecoAssociado = produto.preco_associado != null;
  const linhas = [
    'Olá! Vi seu produto no IUB Marketplace e tenho interesse.',
    '',
    `🛍️ Produto: ${produto.nome}`,
    `💰 Preço: ${formatarPrecoBRL(produto.preco)}`,
  ];

  if (temPrecoAssociado && associado) {
    const diferenca = parseFloat(produto.preco) - parseFloat(produto.preco_associado);
    linhas.push(`💎 Preço Associado: ${formatarPrecoBRL(produto.preco_associado)} (economia de ${formatarPrecoBRL(diferenca)})`);
  }

  if (associado) {
    linhas.push('', `📇 Meu nome: ${associado.nome_completo}`, '🎫 Sou associado SECI ativo', `🔗 Minha carteirinha: ${BACKEND_URL}/carteirinha/${associado.carteirinha_hash}`);
  }

  linhas.push('', associado && temPrecoAssociado ? 'Como posso adquirir com o preço associado?' : 'Poderia me passar mais informações?');

  return linhas.join('\n');
}

async function getProduto(req, res) {
  try {
    const result = await db.query(
      `SELECT
         pr.id, pr.nome, pr.descricao, pr.preco, pr.preco_associado, pr.categoria, pr.marca,
         pr.estoque_disponivel, pr.destaque, pr.fotos, pr.created_at,
         pa.id AS parceiro_id, pa.slug AS parceiro_slug, pa.nome AS parceiro_nome,
         pa.icone AS parceiro_icone, pa.cor_icone AS parceiro_cor_icone, pa.logo_url AS parceiro_logo_url,
         pa.categoria_principal AS parceiro_categoria, pa.endereco AS parceiro_endereco,
         pa.bairro AS parceiro_bairro, pa.cidade AS parceiro_cidade, pa.whatsapp AS parceiro_whatsapp
       FROM sindicato_parceiro_produtos pr
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       WHERE pr.id = $1 AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produto' });
  }
}

async function getOutrosDoParceiro(req, res) {
  try {
    const atual = await db.query('SELECT parceiro_id FROM sindicato_parceiro_produtos WHERE id = $1', [req.params.id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });

    const result = await db.query(
      `SELECT id, nome, preco, preco_associado, fotos FROM sindicato_parceiro_produtos
       WHERE parceiro_id = $1 AND id != $2 AND ativo = true AND rascunho = false
       ORDER BY created_at DESC LIMIT 6`,
      [atual.rows[0].parceiro_id, req.params.id]
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar outros produtos' });
  }
}

// Sem autenticacao (pagina publica) - so aceita os tipos conhecidos, pra nao
// virar uma gaveta de lixo com "tipo" arbitrario vindo do cliente.
async function registrarEvento(req, res) {
  try {
    const tipo = TIPOS_EVENTO_VALIDOS.includes(req.body.tipo) ? req.body.tipo : 'ver_produto';

    const produto = await db.query('SELECT id, parceiro_id FROM sindicato_parceiro_produtos WHERE id = $1', [req.params.id]);
    if (!produto.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });

    const associadoId = await buscarAssociadoIdPorHash(req.body.associado_hash);
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    await db.query(
      `INSERT INTO sindicato_parceiro_cliques (parceiro_id, produto_id, tipo, associado_id, ip_origem, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [produto.rows[0].parceiro_id, produto.rows[0].id, tipo, associadoId, ip || null, req.headers['user-agent'] || null]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar evento' });
  }
}

// Monta a mensagem de WhatsApp ja pronta pro front so abrir o wa.me -
// centraliza no backend porque precisa cruzar produto + status real da
// carteirinha do associado (o front so tem o hash da URL).
async function getMensagemWhatsapp(req, res) {
  try {
    const result = await db.query(
      `SELECT pr.nome, pr.preco, pr.preco_associado, pa.whatsapp AS parceiro_whatsapp
       FROM sindicato_parceiro_produtos pr
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       WHERE pr.id = $1 AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'`,
      [req.params.id]
    );
    const produto = result.rows[0];
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!produto.parceiro_whatsapp) return res.status(422).json({ error: 'Parceiro sem WhatsApp cadastrado' });

    const associado = await buscarAssociadoAtivoPorHash(req.query.associado);
    const mensagem = montarMensagemWhatsapp(produto, associado);

    return res.json({
      mensagem,
      whatsapp_numero: produto.parceiro_whatsapp,
      e_associado_ativo: Boolean(associado),
      url_final: linkWhatsappComTexto(produto.parceiro_whatsapp, mensagem),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao montar mensagem de WhatsApp' });
  }
}

module.exports = { getProduto, getOutrosDoParceiro, registrarEvento, getMensagemWhatsapp };

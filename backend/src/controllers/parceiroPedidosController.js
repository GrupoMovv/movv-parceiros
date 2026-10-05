const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { horarioConfigurado } = require('../config/beer');
const { carregarLoja, modosDisponiveis, transicionar, ErroPedido } = require('../services/pedidoLoja');
const { viewLoja, respostaAcao } = require('./pedidoLinkLojaController');
const { pedidosSiteLiberado } = require('../config/pedidos');
const pedidoAvisos = require('../services/pedidoAvisos');
const { normalizarWhatsapp } = require('../services/whatsappVerificacao');
const { testeLoja } = require('../services/pedidoMensagens');

// Pedido pelo site — lado da LOJA (/api/parceiro/pedidos). Parte 4: ligar
// o recurso, chave Pix, aceite automático e pausa rápida.
// Ligar exige: empresa (CNPJ), tipo produto ou Disk Bebidas, horário
// cadastrado, delivery ou retirada, WhatsApp e chave Pix — e a loja
// CONFIRMA horário/entrega/taxa toda vez que liga (pedidos_confirmado_em):
// os padrões da migration 051 não valem como configuração.

const TIPOS_PIX = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chave no formato do Pix (o mesmo que vai no QR com valor, depois).
function normalizarChavePix(tipo, chave) {
  const bruto = String(chave ?? '').trim();
  if (tipo === 'cpf') { const d = onlyDigits(bruto); return isValidCPF(d) ? d : null; }
  if (tipo === 'cnpj') { const d = onlyDigits(bruto); return isValidCNPJ(d) ? d : null; }
  if (tipo === 'email') { const e = bruto.toLowerCase(); return EMAIL_RE.test(e) && e.length <= 77 ? e : null; }
  if (tipo === 'telefone') {
    const d = onlyDigits(bruto).replace(/^55(?=\d{10,11}$)/, '');
    return d.length === 10 || d.length === 11 ? `+55${d}` : null;
  }
  if (tipo === 'aleatoria') { const a = bruto.toLowerCase(); return UUID_RE.test(a) ? a : null; }
  return null;
}

// Catálogos em que a loja pode vender pelo site e o que falta pra ligar.
// Cada catálogo confere o PRÓPRIO horário e o PRÓPRIO atendimento: o pedido
// do Disk Bebidas usa o horário e a retirada do estabelecimento Beer, e o
// do catálogo geral usa os da loja. Antes uma adega só de bebidas "ligava"
// com a retirada do catálogo geral e o botão nunca aparecia (05/10).
// Catálogo geral = loja de produtos COM produto ativo (tipo_negocio nasce
// 'produto' pra todo mundo, inclusive adega que só vende no Beer).
function requisitos(loja) {
  const vendeGeral = loja.tipo_negocio === 'produto' && loja.qtd_produtos_gerais > 0;
  const vendeBeer = Boolean(loja.beer?.ativo);
  const modosGeral = vendeGeral ? modosDisponiveis(loja, 'geral') : [];
  const modosBeer = vendeBeer ? modosDisponiveis(loja, 'beer') : [];
  const horarioGeralOk = !vendeGeral || horarioConfigurado(loja.horario_funcionamento);
  const horarioBeerOk = !vendeBeer || horarioConfigurado(loja.beer.horario_funcionamento);
  const modos = [...new Set([...modosGeral, ...modosBeer])];
  const lista = [
    { chave: 'cnpj', ok: loja.tipo_pessoa === 'pj', texto: 'Empresa com CNPJ (vendedor pessoa física atende só pelo WhatsApp)' },
    { chave: 'tipo', ok: vendeGeral || vendeBeer, texto: 'Produtos ativos na loja ou Disk Bebidas ativo (serviços atendem pelo WhatsApp)', link: '/parceiro/painel/produtos' },
    { chave: 'horario', ok: horarioGeralOk, texto: 'Horário de funcionamento da loja cadastrado', link: '/parceiro/painel/entrega' },
    { chave: 'horario_beer', ok: horarioBeerOk, texto: 'Horário do Disk Bebidas cadastrado', link: '/parceiro/painel/beer' },
    { chave: 'atendimento', ok: !vendeGeral || modosGeral.length > 0, texto: 'Loja: entrega e/ou retirada marcada', link: '/parceiro/painel/entrega' },
    { chave: 'atendimento_beer', ok: !vendeBeer || modosBeer.length > 0, texto: 'Disk Bebidas: entrega (aba Entrega e horários) e/ou retirada (aba Meu IUB Beer) marcada', link: '/parceiro/painel/entrega' },
    { chave: 'whatsapp', ok: Boolean(onlyDigits(loja.whatsapp).length >= 10 || (vendeBeer && onlyDigits(loja.beer?.whatsapp).length >= 10)), texto: 'WhatsApp da loja cadastrado (é por ele que chega o aviso do pedido)', link: '/parceiro/painel/perfil' },
  ];
  return { lista, catalogos: [vendeGeral && 'geral', vendeBeer && 'beer'].filter(Boolean), modos, podeLigar: lista.every(r => r.ok) };
}

// Loja + quantos produtos do catálogo geral ela tem no ar (define se vende no geral)
async function carregarLojaPainel(parceiroId) {
  const loja = await carregarLoja(parceiroId);
  if (!loja) return loja;
  loja.qtd_produtos_gerais = (await db.query(
    "SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND ativo AND NOT rascunho AND moderacao_status = 'aprovado'",
    [parceiroId]
  )).rows[0].n;
  return loja;
}

function mascarar(n) {
  return n.length >= 10 ? `(${n.slice(0, 2)}) *****-${n.slice(-4)}` : n;
}

// WhatsApps que recebem o aviso de pedido: o da loja (catálogo geral) e o
// do estabelecimento do Disk Bebidas, sem repetir.
function whatsappsAviso(loja) {
  const r = requisitos(loja);
  const nums = [];
  if (r.catalogos.includes('geral')) nums.push(normalizarWhatsapp(loja.whatsapp));
  if (r.catalogos.includes('beer')) nums.push(normalizarWhatsapp(loja.beer?.whatsapp));
  return [...new Set(nums.filter(n => n.length >= 10))];
}

function viewConfig(loja) {
  const req = requisitos(loja);
  return {
    liberado: pedidosSiteLiberado(loja),
    // número do chip que manda os avisos (opcional, pra loja salvar nos contatos)
    numero_avisos: (process.env.ZAPI_NUMERO_EXIBICAO || '').trim() || null,
    // pra onde vão os avisos de pedido (Disk Bebidas: o WhatsApp do estabelecimento)
    whatsapps_aviso: whatsappsAviso(loja).map(mascarar),
    ativo: loja.pedidos_site_ativo,
    pausado: loja.pedidos_pausados,
    aceite_automatico: loja.pedidos_aceite_automatico,
    confirmado_em: loja.pedidos_confirmado_em,
    pix_tipo: loja.pix_tipo, pix_chave: loja.pix_chave, pix_nome_recebedor: loja.pix_nome_recebedor,
    requisitos: req.lista, pode_ligar: req.podeLigar, catalogos: req.catalogos,
    // o que a loja confirma ao ligar (lido do perfil / Disk Bebidas)
    resumo: {
      horario_funcionamento: loja.horario_funcionamento,
      horario_beer: loja.beer?.horario_funcionamento || null,
      modos: req.modos,
      taxa_entrega: loja.taxa_entrega, entrega_gratis_acima: loja.entrega_gratis_acima,
      raio_entrega_km: loja.raio_entrega_km, tempo_preparo_min: loja.tempo_preparo_min,
      bairros_beer: loja.beer?.bairros_entrega || [], retirada_beer: loja.beer ? Boolean(loja.beer.retirada_disponivel) : null,
    },
  };
}

// GET /config
async function getConfig(req, res) {
  try {
    return res.json(viewConfig(await carregarLojaPainel(req.parceiro.id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar a configuração de pedidos' });
  }
}

// PUT /config  { ativo, pix_tipo, pix_chave, pix_nome_recebedor, aceite_automatico, confirmo_configuracao }
// Ligar (ou continuar ligado mudando Pix) sempre com confirmo_configuracao = true.
async function salvarConfig(req, res) {
  try {
    const b = req.body || {};
    const loja = await carregarLojaPainel(req.parceiro.id);
    const ativo = b.ativo === true;
    const aceite = b.aceite_automatico === true;
    let pix = { tipo: loja.pix_tipo, chave: loja.pix_chave, nome: loja.pix_nome_recebedor };

    if (b.pix_tipo !== undefined || b.pix_chave !== undefined || b.pix_nome_recebedor !== undefined) {
      if (!TIPOS_PIX.includes(b.pix_tipo)) return res.status(400).json({ error: 'Escolha o tipo da chave Pix.', campo: 'pix_tipo' });
      const chave = normalizarChavePix(b.pix_tipo, b.pix_chave);
      if (!chave) return res.status(400).json({ error: 'Chave Pix inválida para o tipo escolhido.', campo: 'pix_chave' });
      const nome = String(b.pix_nome_recebedor ?? '').trim().replace(/\s+/g, ' ');
      if (nome.length < 2 || nome.length > 25) {
        return res.status(400).json({ error: 'Nome de quem recebe o Pix: de 2 a 25 letras, igual aparece no banco.', campo: 'pix_nome_recebedor' });
      }
      pix = { tipo: b.pix_tipo, chave, nome };
    }

    if (ativo) {
      if (!pedidosSiteLiberado(loja)) {
        return res.status(409).json({ error: 'Pedidos pelo site ainda não foram liberados. Em breve!', code: 'EM_BREVE' });
      }
      const r = requisitos(loja);
      if (!r.podeLigar) {
        return res.status(409).json({ error: 'Falta completar o cadastro para receber pedidos pelo site.', code: 'REQUISITOS', requisitos: r.lista });
      }
      if (!pix.chave) return res.status(400).json({ error: 'Cadastre a chave Pix da loja.', campo: 'pix_chave' });
      if (b.confirmo_configuracao !== true) {
        return res.status(400).json({ error: 'Confira o horário, a entrega/retirada e a taxa, e marque a confirmação.', campo: 'confirmo_configuracao' });
      }
    }

    const r = await db.query(
      `UPDATE sindicato_parceiros SET
         pedidos_site_ativo = $1, pedidos_aceite_automatico = $2,
         pix_tipo = $3, pix_chave = $4, pix_nome_recebedor = $5,
         pedidos_confirmado_em = CASE WHEN $1 THEN NOW() ELSE pedidos_confirmado_em END,
         pedidos_pausados = CASE WHEN $1 AND NOT pedidos_site_ativo THEN false ELSE pedidos_pausados END,
         updated_at = NOW()
       WHERE id = $6 RETURNING id`,
      [ativo, aceite, pix.tipo, pix.chave, pix.nome, req.parceiro.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Loja não encontrada' });
    return res.json(viewConfig(await carregarLojaPainel(req.parceiro.id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar a configuração de pedidos' });
  }
}

// PATCH /config/pausa  { pausado } — liga/desliga rápido (pedidos já feitos seguem)
async function pausar(req, res) {
  try {
    const r = await db.query(
      `UPDATE sindicato_parceiros SET pedidos_pausados = $1, updated_at = NOW()
       WHERE id = $2 AND pedidos_site_ativo RETURNING id`,
      [req.body?.pausado === true, req.parceiro.id]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'Ligue o recebimento de pedidos primeiro.' });
    return res.json(viewConfig(await carregarLojaPainel(req.parceiro.id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao pausar pedidos' });
  }
}

// POST /config/teste — manda o aviso de teste pros WhatsApps de pedido, pra
// loja confirmar que chega e que o link abre. 1 por minuto por loja.
const ultimoTeste = new Map();
async function enviarTeste(req, res) {
  try {
    const agora = Date.now();
    const desde = agora - (ultimoTeste.get(req.parceiro.id) || 0);
    if (desde < 60000) {
      const aguarde = Math.ceil((60000 - desde) / 1000);
      return res.status(429).json({ error: `Aguarde ${aguarde}s para mandar outro teste.`, aguarde_seg: aguarde });
    }
    const loja = await carregarLojaPainel(req.parceiro.id);
    const nums = whatsappsAviso(loja);
    if (!nums.length) return res.status(409).json({ error: 'Cadastre o WhatsApp da loja primeiro.' });
    ultimoTeste.set(req.parceiro.id, agora);
    const envios = [];
    for (const n of nums) envios.push({ whatsapp: mascarar(n), enviado: await pedidoAvisos.enviar(n, testeLoja(loja.nome)) });
    return res.json({ envios });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao mandar o aviso de teste' });
  }
}

// ── Aba Pedidos (parte 7) ──────────────────────────────────────────────
// Mesmas abas da agenda do PET: Para responder / Em andamento / Encerrados.
const FILTROS_PEDIDOS = {
  responder: ['enviado'],
  andamento: ['aceito', 'pago_saiu'],
  encerrados: ['entregue', 'recusado', 'cancelado', 'expirado'],
};

// GET /  ?filtro=responder|andamento|encerrados
async function listarPedidos(req, res) {
  try {
    const filtro = FILTROS_PEDIDOS[req.query.filtro] ? req.query.filtro : 'responder';
    const r = await db.query(
      `SELECT * FROM loja_pedidos WHERE parceiro_id = $1 AND status = ANY($2)
       ORDER BY ${filtro === 'encerrados' ? 'COALESCE(encerrado_em, created_at) DESC' : 'created_at ASC'} LIMIT 60`,
      [req.parceiro.id, FILTROS_PEDIDOS[filtro]]
    );
    const contagem = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'enviado')::int AS responder,
              COUNT(*) FILTER (WHERE status IN ('aceito', 'pago_saiu'))::int AS andamento
       FROM loja_pedidos WHERE parceiro_id = $1`,
      [req.parceiro.id]
    )).rows[0];
    const pedidos = [];
    for (const p of r.rows) pedidos.push(await viewLoja(p));
    return res.json({ pedidos, contagem });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar os pedidos' });
  }
}

// GET /:id
async function verPedido(req, res) {
  try {
    const p = (await db.query('SELECT * FROM loja_pedidos WHERE id = $1 AND parceiro_id = $2', [req.params.id, req.parceiro.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Pedido não encontrado' });
    return res.json(await viewLoja(p));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar o pedido' });
  }
}

// POST /:id/:acao  (aceitar | recusar | pago_saiu | cancelar) — mesmas regras do link sem login
async function agirPedido(req, res) {
  try {
    const acao = req.params.acao;
    if (!['aceitar', 'recusar', 'pago_saiu', 'cancelar'].includes(acao)) return res.status(400).json({ error: 'Ação inválida.' });
    const { pedido, aviso } = await transicionar(Number(req.params.id), 'loja', acao, {
      parceiroId: req.parceiro.id,
      resposta: ['recusar', 'cancelar'].includes(acao) ? req.body?.resposta : undefined,
      confirmoCancelarPago: acao === 'cancelar' && req.body?.confirmo_cancelar_pago === true,
    });
    return res.json(await respostaAcao(pedido, aviso));
  } catch (err) {
    if (err instanceof ErroPedido) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos atualizar o pedido agora.' });
  }
}

module.exports = {
  getConfig, salvarConfig, pausar, enviarTeste, normalizarChavePix, requisitos,
  listarPedidos, verPedido, agirPedido,
};

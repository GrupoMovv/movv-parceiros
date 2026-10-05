const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { horarioConfigurado } = require('../config/beer');
const { carregarLoja, modosDisponiveis } = require('../services/pedidoLoja');
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
function requisitos(loja) {
  const vendeGeral = loja.tipo_negocio === 'produto';
  const vendeBeer = Boolean(loja.beer?.ativo);
  const horarioOk = (vendeGeral && horarioConfigurado(loja.horario_funcionamento))
    || (vendeBeer && horarioConfigurado(loja.beer.horario_funcionamento));
  const modos = [...new Set([...(vendeGeral ? modosDisponiveis(loja, 'geral') : []), ...(vendeBeer ? modosDisponiveis(loja, 'beer') : [])])];
  const lista = [
    { chave: 'cnpj', ok: loja.tipo_pessoa === 'pj', texto: 'Empresa com CNPJ (vendedor pessoa física atende só pelo WhatsApp)' },
    { chave: 'tipo', ok: vendeGeral || vendeBeer, texto: 'Loja de produtos ou do Disk Bebidas (serviços atendem pelo WhatsApp)' },
    { chave: 'horario', ok: horarioOk, texto: 'Horário de funcionamento cadastrado', link: vendeBeer && !vendeGeral ? '/parceiro/painel/beer' : '/parceiro/painel/entrega' },
    { chave: 'atendimento', ok: modos.length > 0, texto: 'Entrega e/ou retirada marcada', link: '/parceiro/painel/entrega' },
    { chave: 'whatsapp', ok: Boolean(onlyDigits(loja.whatsapp).length >= 10 || (vendeBeer && onlyDigits(loja.beer?.whatsapp).length >= 10)), texto: 'WhatsApp da loja cadastrado (é por ele que chega o aviso do pedido)', link: '/parceiro/painel/perfil' },
  ];
  return { lista, catalogos: [vendeGeral && 'geral', vendeBeer && 'beer'].filter(Boolean), modos, podeLigar: lista.every(r => r.ok) };
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
    return res.json(viewConfig(await carregarLoja(req.parceiro.id)));
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
    const loja = await carregarLoja(req.parceiro.id);
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
    return res.json(viewConfig(await carregarLoja(req.parceiro.id)));
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
    return res.json(viewConfig(await carregarLoja(req.parceiro.id)));
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
    const loja = await carregarLoja(req.parceiro.id);
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

module.exports = { getConfig, salvarConfig, pausar, enviarTeste, normalizarChavePix, requisitos };

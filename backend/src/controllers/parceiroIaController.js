const db = require('../config/database');
const { limiteIA, limiteVozDia, planoEfetivo } = require('../config/planos');
const openaiService = require('../services/openaiService');

const TRIAL_DIAS = 3;
const RATE_LIMIT_MAX = 5; // chamadas por minuto, por parceiro

function mesReferenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// `plano_iniciado_em` nasce com o parceiro (DEFAULT NOW() na migration
// 050) — trial de IA ilimitada só nos primeiros TRIAL_DIAS a partir dali.
function infoTrial(parceiro) {
  const inicio = new Date(parceiro.plano_iniciado_em);
  const diasPassados = (Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24);
  const ativo = diasPassados <= TRIAL_DIAS;
  return { ativo, diasRestantes: ativo ? Math.max(0, Math.ceil(TRIAL_DIAS - diasPassados)) : 0 };
}

// Só conta análise por FOTO — cadastro por voz ('cadastro_voz') tem cota
// diária própria (contarUsosVozHoje) e não pode comer a cota mensal daqui.
async function contarUsosMes(parceiroId) {
  const r = await db.query(
    "SELECT COUNT(*)::int AS total FROM sindicato_ia_uso WHERE parceiro_id = $1 AND mes_referencia = $2 AND tipo = 'analise_produto'",
    [parceiroId, mesReferenciaAtual()]
  );
  return r.rows[0].total;
}

// "Hoje" no fuso de Itumbiara, não do servidor (Render roda em UTC — sem
// isso a cota "virava" às 21h daqui).
// Cota é de CADASTROS por dia: voz rápida ('cadastro_voz') = 1 cadastro por
// chamada; voz guiada ('cadastro_voz_etapa') faz 3 chamadas por produto
// (nome/descrição/preço), então cada etapa vale 1/3 — sem isso o Grátis
// (20/dia) cadastraria só ~6 produtos pela guiada. Regravar também conta
// 1/3 (a chamada ao Whisper é cobrada igual). Pode voltar fracionário.
async function contarUsosVozHoje(parceiroId) {
  const r = await db.query(
    `SELECT COUNT(*) FILTER (WHERE tipo = 'cadastro_voz')::int AS rapida,
            COUNT(*) FILTER (WHERE tipo = 'cadastro_voz_etapa')::int AS etapas
     FROM sindicato_ia_uso
     WHERE parceiro_id = $1 AND tipo IN ('cadastro_voz', 'cadastro_voz_etapa')
       AND data_uso >= (date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')`,
    [parceiroId]
  );
  return r.rows[0].rapida + r.rows[0].etapas / 3;
}

async function contarUsosUltimoMinuto(parceiroId) {
  const r = await db.query(
    "SELECT COUNT(*)::int AS total FROM sindicato_ia_uso WHERE parceiro_id = $1 AND data_uso > NOW() - INTERVAL '1 minute'",
    [parceiroId]
  );
  return r.rows[0].total;
}

// GET /parceiro/produtos/ia-status — alimenta o contador "IA: 45/50 usos
// este mês" e o banner de trial no painel (item 8/7 do pedido).
async function getStatus(req, res) {
  try {
    const parceiro = req.parceiro;
    const trial = infoTrial(parceiro);
    const limite = limiteIA(planoEfetivo(parceiro));
    const usados = await contarUsosMes(parceiro.id);
    const limiteFinito = Number.isFinite(limite);
    const limiteVoz = limiteVozDia(planoEfetivo(parceiro));
    const vozUsadosHoje = await contarUsosVozHoje(parceiro.id);
    return res.json({
      trial_ativo: trial.ativo,
      trial_dias_restantes: trial.diasRestantes,
      plano: planoEfetivo(parceiro),
      limite: limiteFinito ? limite : null,
      usados,
      restantes: trial.ativo || !limiteFinito ? null : Math.max(0, limite - usados),
      voz_limite_dia: Number.isFinite(limiteVoz) ? limiteVoz : null,
      voz_usados_hoje: Math.ceil(vozUsadosHoje),
    });
  } catch (err) {
    console.error('[parceiroIaController.getStatus]', err);
    return res.status(500).json({ error: 'Erro ao consultar uso da IA' });
  }
}

// POST /parceiro/produtos/analisar-imagem — recebe 1 imagem (multer
// memoryStorage, campo "imagem"), devolve os dados sugeridos pela IA.
// Não cria nem altera produto nenhum — só sugere; quem confirma/salva é
// o fluxo normal de ProdutoForm.jsx.
async function analisarImagem(req, res) {
  try {
    const parceiro = req.parceiro;
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem' });

    // Rate limit primeiro (mais barato) — protege contra clique repetido/
    // loop antes de sequer checar cota mensal.
    const usosRecentes = await contarUsosUltimoMinuto(parceiro.id);
    if (usosRecentes >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Muitas análises em pouco tempo — aguarde um minuto e tente de novo.', codigo: 'RATE_LIMIT' });
    }

    const trial = infoTrial(parceiro);
    if (!trial.ativo) {
      const limite = limiteIA(planoEfetivo(parceiro));
      if (Number.isFinite(limite)) {
        const usados = await contarUsosMes(parceiro.id);
        if (usados >= limite) {
          return res.status(403).json({
            error: `Você usou seus ${limite} usos de IA este mês.`,
            codigo: 'LIMITE_ATINGIDO',
            limite, usados, plano: planoEfetivo(parceiro),
          });
        }
      }
    }

    let dados;
    try {
      dados = await openaiService.analisarProdutoPorImagem(req.file.buffer, req.file.mimetype);
    } catch (err) {
      return responderErroIA(res, err);
    }

    // dados === null: a própria IA não reconheceu um produto na imagem —
    // ainda assim registra e conta pra cota mensal, porque o custo da
    // chamada à OpenAI já foi gasto de qualquer forma (é isso que a cota
    // existe pra controlar). Só não é tratado como erro de servidor: o
    // parceiro recebe uma mensagem específica pra tentar outra foto.
    if (!dados) {
      await registrarUso(parceiro.id, null);
      return res.status(422).json({ error: 'A IA não conseguiu identificar um produto nessa foto. Tente outra imagem ou descreva manualmente.', codigo: 'NAO_IDENTIFICADO' });
    }

    await registrarUso(parceiro.id, dados);
    return res.json(dados);
  } catch (err) {
    console.error('[parceiroIaController.analisarImagem]', err);
    return res.status(500).json({ error: 'Erro ao analisar imagem' });
  }
}

async function registrarUso(parceiroId, dados, tipo = 'analise_produto') {
  await db.query(
    'INSERT INTO sindicato_ia_uso (parceiro_id, tipo, resposta_json) VALUES ($1, $2, $3)',
    [parceiroId, tipo, dados ? JSON.stringify(dados) : null]
  );
}

// POST /parceiro/produtos/cadastrar-por-voz — recebe o áudio gravado no
// navegador (multer memoryStorage, campo "audio"), transcreve (Whisper) e
// estrutura (GPT-4o). Igual analisarImagem: só SUGERE, quem salva é o
// fluxo normal de ProdutoForm.jsx depois que o comerciante confere.
async function cadastrarPorVoz(req, res) {
  try {
    const parceiro = req.parceiro;
    if (!req.file) return res.status(400).json({ error: 'Envie o áudio gravado' });

    const bloqueio = await checarCotaVoz(parceiro, RATE_LIMIT_MAX);
    if (bloqueio) return res.status(bloqueio.status).json(bloqueio.corpo);

    let transcricao;
    try {
      transcricao = await openaiService.transcreverAudio(req.file.buffer, req.file.mimetype);
    } catch (err) {
      return responderErroIA(res, err);
    }

    // Whisper já foi cobrado a partir daqui — registra o uso mesmo quando
    // não sai produto nenhum (mesmo raciocínio de analisarImagem).
    if (transcricao.length < 3) {
      await registrarUso(parceiro.id, { transcricao }, 'cadastro_voz');
      return res.status(422).json({ error: 'Não deu pra ouvir nada no áudio. Chegue mais perto do microfone e tente de novo.', codigo: 'NAO_IDENTIFICADO', transcricao });
    }

    let dados;
    try {
      dados = await openaiService.estruturarProdutoPorTexto(transcricao);
    } catch (err) {
      await registrarUso(parceiro.id, { transcricao }, 'cadastro_voz');
      return responderErroIA(res, err);
    }

    if (!dados) {
      await registrarUso(parceiro.id, { transcricao }, 'cadastro_voz');
      return res.status(422).json({ error: 'Não entendi qual produto você quis cadastrar. Tente falar o nome, o que vem nele e o preço.', codigo: 'NAO_IDENTIFICADO', transcricao });
    }

    const resposta = { ...dados, transcricao };
    await registrarUso(parceiro.id, resposta, 'cadastro_voz');
    return res.json(resposta);
  } catch (err) {
    console.error('[parceiroIaController.cadastrarPorVoz]', err);
    return res.status(500).json({ error: 'Erro ao processar o áudio' });
  }
}

// null = pode seguir; senão { status, corpo } pronto pra responder.
// Rate limit primeiro (mais barato), depois a cota diária de cadastros.
async function checarCotaVoz(parceiro, maxPorMinuto) {
  const usosRecentes = await contarUsosUltimoMinuto(parceiro.id);
  if (usosRecentes >= maxPorMinuto) {
    return { status: 429, corpo: { error: 'Muitos cadastros em pouco tempo — aguarde um minuto e tente de novo.', codigo: 'RATE_LIMIT' } };
  }
  const limite = limiteVozDia(planoEfetivo(parceiro));
  if (!Number.isFinite(limite)) return null;
  const usadosHoje = await contarUsosVozHoje(parceiro.id);
  if (usadosHoje < limite) return null;
  return {
    status: 403,
    corpo: {
      error: `Você usou seus ${limite} cadastros por voz de hoje. Amanhã libera de novo — ou cadastre manualmente.`,
      codigo: 'LIMITE_ATINGIDO',
      limite, usados: Math.ceil(usadosHoje), plano: planoEfetivo(parceiro),
    },
  };
}

const ETAPAS_VOZ_GUIADA = ['nome', 'descricao', 'preco'];
// A guiada faz 3+ chamadas por produto (mais se regravar) — 5/min, o limite
// da rápida, travava quem regrava uma vez só. 10/min ainda barra loop.
const RATE_LIMIT_GUIADA = 10;
const ERRO_ETAPA = {
  nome: 'Não entendi o nome do produto. Fale só o nome, ex.: "X-Bacon".',
  descricao: 'Não entendi a descrição. Fale o que vem no produto, ex.: "pão, hambúrguer, bacon e cheddar".',
  preco: 'Não entendi o preço. Fale só o valor, ex.: "vinte e nove e noventa".',
};

// POST /parceiro/produtos/cadastrar-por-voz-guiada — uma ETAPA do cadastro
// guiado por vez (campo "etapa": nome | descricao | preco, + "audio").
// "nome" (opcional) dá contexto pra etapa de descrição. Devolve só o valor
// daquela etapa; montar/salvar o produto é com o front (ProdutoForm).
async function cadastrarPorVozGuiada(req, res) {
  try {
    const parceiro = req.parceiro;
    const etapa = String(req.body.etapa || '');
    if (!ETAPAS_VOZ_GUIADA.includes(etapa)) return res.status(400).json({ error: 'Etapa inválida' });
    if (!req.file) return res.status(400).json({ error: 'Envie o áudio gravado' });

    const bloqueio = await checarCotaVoz(parceiro, RATE_LIMIT_GUIADA);
    if (bloqueio) return res.status(bloqueio.status).json(bloqueio.corpo);

    let transcricao;
    try {
      transcricao = await openaiService.transcreverAudio(req.file.buffer, req.file.mimetype);
    } catch (err) {
      return responderErroIA(res, err);
    }

    const registrar = dados => registrarUso(parceiro.id, { etapa, transcricao, ...dados }, 'cadastro_voz_etapa');

    if (transcricao.length < 2) {
      await registrar({});
      return res.status(422).json({ error: 'Não deu pra ouvir nada no áudio. Chegue mais perto do microfone e tente de novo.', codigo: 'NAO_IDENTIFICADO', transcricao });
    }

    let valor;
    try {
      valor = await openaiService.extrairEtapaVoz(etapa, transcricao, { nome: String(req.body.nome || '').slice(0, 100) });
    } catch (err) {
      await registrar({});
      return responderErroIA(res, err);
    }

    await registrar({ valor });
    if (valor === null) {
      return res.status(422).json({ error: ERRO_ETAPA[etapa], codigo: 'NAO_IDENTIFICADO', transcricao });
    }
    return res.json({ etapa, valor, transcricao });
  } catch (err) {
    console.error('[parceiroIaController.cadastrarPorVozGuiada]', err);
    return res.status(500).json({ error: 'Erro ao processar o áudio' });
  }
}

function responderErroIA(res, err) {
  console.error('[parceiroIaController] Falha na chamada à IA:', err?.codigo, err?.message);
  const timeout = err?.codigo === 'TIMEOUT';
  return res.status(timeout ? 504 : 502).json({
    error: timeout
      ? 'A IA demorou demais pra responder. Tente de novo ou cadastre manualmente.'
      : 'IA temporariamente indisponível. Tente novamente ou cadastre manualmente.',
    codigo: err?.codigo || 'ERRO_IA',
  });
}

module.exports = { getStatus, analisarImagem, cadastrarPorVoz, cadastrarPorVozGuiada };

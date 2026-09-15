const db = require('../config/database');
const { limiteIA, planoEfetivo } = require('../config/planos');
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

async function contarUsosMes(parceiroId) {
  const r = await db.query(
    'SELECT COUNT(*)::int AS total FROM sindicato_ia_uso WHERE parceiro_id = $1 AND mes_referencia = $2',
    [parceiroId, mesReferenciaAtual()]
  );
  return r.rows[0].total;
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
    return res.json({
      trial_ativo: trial.ativo,
      trial_dias_restantes: trial.diasRestantes,
      plano: planoEfetivo(parceiro),
      limite: limiteFinito ? limite : null,
      usados,
      restantes: trial.ativo || !limiteFinito ? null : Math.max(0, limite - usados),
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
      console.error('[parceiroIaController] Falha na chamada à IA:', err?.codigo, err?.message);
      const timeout = err?.codigo === 'TIMEOUT';
      return res.status(timeout ? 504 : 502).json({
        error: timeout
          ? 'A IA demorou demais pra responder. Tente de novo ou cadastre manualmente.'
          : 'IA temporariamente indisponível. Tente novamente ou cadastre manualmente.',
        codigo: err?.codigo || 'ERRO_IA',
      });
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

async function registrarUso(parceiroId, dados) {
  await db.query(
    "INSERT INTO sindicato_ia_uso (parceiro_id, tipo, resposta_json) VALUES ($1, 'analise_produto', $2)",
    [parceiroId, dados ? JSON.stringify(dados) : null]
  );
}

module.exports = { getStatus, analisarImagem };

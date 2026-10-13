// Importação mensal da Azul (livro de comissões do Partner, Etapa 2).
// O arquivo vem por upload e fica só na memória: nunca é gravado em disco
// (os relatórios reais têm CPF de clientes) e nunca vai para log.
const db = require('../config/database');
const imp = require('../services/azulImportacao');
const { ErroComissao } = require('../services/partnerComissoes');
const { registrarAcao, nomeDoAdmin } = require('../services/registroAdmin');

function responderErro(res, err, padrao) {
  if (err instanceof ErroComissao) return res.status(err.status).json({ error: err.message });
  // erro de leitura do arquivo (formato, coluna faltando): mensagem é segura, sem dado de cliente
  if (err?.message && /^O arquivo /.test(err.message)) return res.status(400).json({ error: err.message });
  console.error('[IMPORTACAO AZUL]', err?.message);
  return res.status(500).json({ error: padrao });
}

function arquivoDe(req) {
  if (!req.file?.buffer?.length) throw new ErroComissao('Envie o arquivo do relatório da Azul (.csv do Domus ou .xls).');
  return req.file;
}

async function previa(req, res) {
  try {
    const f = arquivoDe(req);
    return res.json(await imp.previa(db, f.buffer));
  } catch (err) {
    return responderErro(res, err, 'Erro ao ler o arquivo');
  }
}

async function confirmar(req, res) {
  try {
    const f = arquivoDe(req);
    const r = await db.transacao(async cx => {
      const out = await imp.confirmar(cx, f.buffer, f.originalname, nomeDoAdmin(req.user), req.user?.id);
      await registrarAcao(cx, req, 'importacao_azul', 'comissao_importacoes', out.importacao.id,
        { novas: out.importacao.linhas_novas, total_partners: out.importacao.total_partners });
      return out;
    });
    return res.status(201).json(r);
  } catch (err) {
    return responderErro(res, err, 'Erro ao importar');
  }
}

async function historico(req, res) {
  try { return res.json(await imp.historico(db)); } catch (err) { return responderErro(res, err, 'Erro ao listar importações'); }
}

async function pendencias(req, res) {
  try { return res.json(await imp.pendencias(db)); } catch (err) { return responderErro(res, err, 'Erro ao listar pendências'); }
}

// Confirmação de sugestões em lote: cada linha na sua transação, para uma
// recusa (ex.: indicação que já recebeu outro contrato) não travar as outras.
async function confirmarSugestoes(req, res) {
  const ids = [...new Set((req.body?.linha_ids || []).map(Number).filter(Boolean))];
  if (!ids.length) return res.status(400).json({ error: 'Nenhuma linha informada.' });
  const feitos = [];
  const recusados = [];
  for (const id of ids) {
    try {
      const r = await db.transacao(async cx => {
        const out = await imp.confirmarSugestao(cx, id, nomeDoAdmin(req.user));
        await registrarAcao(cx, req, 'importacao_sugestao_confirmada', 'comissao_importacao_linhas', id,
          out.lancamento ? { lancamento: out.lancamento.id } : { sem_regra: out.sem_regra });
        return out;
      });
      feitos.push(r);
    } catch (err) {
      if (!(err instanceof ErroComissao)) console.error('[IMPORTACAO AZUL] sugestao', id, err?.message);
      recusados.push({ linha_id: id, motivo: err instanceof ErroComissao ? err.message : 'Erro interno' });
    }
  }
  return res.json({ feitos, recusados });
}

function acaoLinha(nome, fn) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await db.transacao(async cx => {
        const out = await fn(cx, id, req.body || {}, nomeDoAdmin(req.user));
        await registrarAcao(cx, req, nome, 'comissao_importacao_linhas', id, req.body?.motivo ? { motivo: req.body.motivo } : null);
        return out;
      });
      return res.json(r);
    } catch (err) {
      return responderErro(res, err, 'Erro ao atualizar a linha');
    }
  };
}

const vincular = acaoLinha('importacao_linha_vinculada', (cx, id, b, quem) => imp.vincular(cx, id, b.referral_id, quem));
const descartar = acaoLinha('importacao_linha_descartada', (cx, id, b, quem) => imp.descartar(cx, id, quem));
const tentar = acaoLinha('importacao_linha_tentada', (cx, id, b, quem) => imp.tentarSemRegra(cx, id, quem));
const decidirEstorno = acaoLinha('importacao_estorno_decidido', (cx, id, b, quem) => imp.decidirEstorno(cx, id, b.acao, b.motivo, quem));

async function buscarLinhas(req, res) {
  try { return res.json(await imp.buscarLinhas(db, req.query.busca)); } catch (err) { return responderErro(res, err, 'Erro na busca'); }
}

async function buscarIndicacoes(req, res) {
  try { return res.json(await imp.buscarIndicacoes(db, req.query.busca)); } catch (err) { return responderErro(res, err, 'Erro na busca'); }
}

module.exports = {
  previa, confirmar, historico, pendencias, confirmarSugestoes,
  vincular, descartar, tentar, decidirEstorno, buscarLinhas, buscarIndicacoes,
};

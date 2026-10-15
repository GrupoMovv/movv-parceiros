// Chave PIX e documento do MOVV Partner (migration 098). Regras em
// services/partnerCadastro.js. CPF, CNPJ e chave completos nunca vão para
// log, mensagem de erro nem admin_acoes.
const db = require('../config/database');
const cad = require('../services/partnerCadastro');
const { ErroComissao } = require('../services/partnerComissoes');
const { registrarAcao, nomeDoAdmin } = require('../services/registroAdmin');

function responderErro(res, err, padrao) {
  if (err instanceof ErroComissao) return res.status(err.status).json({ error: err.message });
  // sem a mensagem do banco: ela pode trazer o valor digitado
  console.error('[CADASTRO PARTNER]', err?.code || 'erro');
  return res.status(500).json({ error: padrao });
}

// ─── Partner ────────────────────────────────────────────────────────────────

async function meuPerfil(req, res) {
  try {
    return res.json(await cad.perfilDoPartner(db, req.user.id));
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar o seu cadastro');
  }
}

async function trocarMeuPix(req, res) {
  try {
    const r = await db.transacao(cx => cad.trocarPixDoPartner(cx, req.user, req.body || {}));
    return res.json(r);
  } catch (err) {
    return responderErro(res, err, 'Erro ao salvar a chave PIX');
  }
}

// ─── Equipe (admin e financeiro) ────────────────────────────────────────────

async function listar(req, res) {
  try {
    return res.json(await cad.listarCadastros(db, { soIncompletos: req.query.incompletos === '1' }));
  } catch (err) {
    return responderErro(res, err, 'Erro ao listar os cadastros');
  }
}

async function completo(req, res) {
  try {
    return res.json(await cad.cadastroCompleto(db, Number(req.params.id)));
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar o cadastro');
  }
}

async function salvarDocumento(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await db.transacao(async cx => {
      const out = await cad.salvarDocumento(cx, id, req.body || {}, nomeDoAdmin(req.user));
      await registrarAcao(cx, req, 'partner_documento_salvo', 'partners', id, out); // só valores mascarados
      return out;
    });
    return res.json({ ok: true, documento: r.depois.documento, tipo_parceiro: r.depois.tipo_parceiro });
  } catch (err) {
    return responderErro(res, err, 'Erro ao salvar o documento');
  }
}

module.exports = { meuPerfil, trocarMeuPix, listar, completo, salvarDocumento };

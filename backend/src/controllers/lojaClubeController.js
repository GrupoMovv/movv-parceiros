// Loja do Clube MAIS+ — painel da loja (/api/parceiro/clube) e admin
// (/api/sindicato-clube). Regras em services/lojaClube.js.
const db = require('../config/database');
const lc = require('../services/lojaClube');
const { PRECO_LOJA_CLUBE_NO_SITE, ALERTA_PRECO_PCT, ALERTA_PRECO_DIAS } = require('../config/clube');
const { nomeDoAdmin } = require('../services/registroAdmin');

function responderErro(res, err) {
  if (err instanceof lc.ErroClube) return res.status(err.status).json({ error: err.message, codigo: err.codigo });
  console.error('[loja do clube]', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}
const meta = req => ({
  ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 64) || null,
  userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
});

// ---------- painel da loja ----------
async function ver(req, res) {
  try {
    return res.json({ ...(await lc.estado(req.parceiro.id)), preco_no_site: PRECO_LOJA_CLUBE_NO_SITE });
  } catch (err) { return responderErro(res, err); }
}

async function salvar(req, res) {
  try {
    const r = await lc.salvar(req.parceiro.id, req.parceiroUsuario, req.body, meta(req));
    return res.json({ ...r, ...(await lc.estado(req.parceiro.id)), preco_no_site: PRECO_LOJA_CLUBE_NO_SITE });
  } catch (err) { return responderErro(res, err); }
}

async function sair(req, res) {
  try {
    await lc.sair(req.parceiro.id, req.parceiroUsuario);
    return res.json({ ...(await lc.estado(req.parceiro.id)), preco_no_site: PRECO_LOJA_CLUBE_NO_SITE });
  } catch (err) { return responderErro(res, err); }
}

// ---------- admin ----------
async function resumo(req, res) {
  try {
    const q = async (s, p) => (await db.query(s, p)).rows;
    const numeros = (await q(`SELECT
        (SELECT count(*) FROM loja_clube WHERE ativo)::int AS lojas_do_clube,
        (SELECT count(*) FROM clube_interessados)::int AS interessados,
        (SELECT count(*) FROM clube_interessados WHERE autorizou_contato)::int AS interessados_autorizaram`))[0];
    const termo = await lc.termoVigente();
    const lojas = await q(
      `SELECT p.id, p.nome, p.slug, p.empresa_teste, lc.ativo, lc.percentual, lc.alcance, lc.entrega_gratis, lc.termo_versao,
              lc.entrou_em, lc.saiu_em, lc.motivo_saida,
              (SELECT count(*)::int FROM loja_clube_produtos x WHERE x.parceiro_id = p.id) AS produtos_escolhidos,
              (SELECT a.aceito_em FROM loja_clube_aceites a WHERE a.parceiro_id = p.id ORDER BY a.aceito_em DESC, a.id DESC LIMIT 1) AS ultimo_aceite
         FROM loja_clube lc JOIN sindicato_parceiros p ON p.id = lc.parceiro_id
        ORDER BY lc.ativo DESC, lc.entrou_em DESC NULLS LAST`);
    const interessados = await q(
      `SELECT id, nome, whatsapp, autorizou_contato, origem, criado_em FROM clube_interessados ORDER BY criado_em DESC LIMIT 500`);
    const termos = await q(`SELECT versao, titulo, provisoria, publicado_em, publicado_por, prazo_aceite_dias FROM loja_clube_termos ORDER BY versao DESC`);
    const alertas = await lc.alertasPreco();
    return res.json({ numeros: { ...numeros, alertas_preco: alertas.length }, alerta_regra: { pct: ALERTA_PRECO_PCT, dias: ALERTA_PRECO_DIAS }, alertas_preco: alertas, termo_vigente: termo, termos, lojas: lojas.map(l => ({ ...l, percentual: l.percentual != null ? Number(l.percentual) : null })), interessados });
  } catch (err) { return responderErro(res, err); }
}

async function publicarTermo(req, res) {
  try {
    const t = await lc.publicarVersao(req.body || {}, nomeDoAdmin(req.user));
    return res.status(201).json(t);
  } catch (err) { return responderErro(res, err); }
}

module.exports = { ver, salvar, sair, resumo, publicarTermo };

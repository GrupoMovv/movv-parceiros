// Preço Clube da Loja do Clube (b3): o percentual permanente da loja vira
// mais um candidato do "menor preço" (services/pedidoLoja.js e, no site,
// frontend/.../precoPessoa.js, com a MESMA conta). Incide sobre o preço
// normal, nunca sobre a promoção, e é arredondado para baixo, a favor do
// cliente. Nada se soma.
const db = require('../config/database');
const { PRECO_LOJA_CLUBE_NO_SITE } = require('../config/clube');

// Preço normal com o percentual do Clube, em centavos inteiros, para baixo.
function precoComClube(normal, pct) {
  const centavos = Math.round(Number(normal) * 100);
  return Math.floor((centavos * (1000 - Math.round(Number(pct) * 10))) / 1000) / 100;
}

// Pedaço de SQL: percentual do Clube que vale para o item (NULL = não vale).
// catalogo: 'geral' | 'beer'; itemId e parceiroId são expressões SQL.
function sqlClubePct(catalogo, itemId, parceiroId) {
  if (!PRECO_LOJA_CLUBE_NO_SITE) return 'NULL::numeric';
  return `(SELECT lc.percentual FROM loja_clube lc
            WHERE lc.parceiro_id = ${parceiroId} AND lc.ativo AND lc.percentual IS NOT NULL
              AND (lc.alcance = 'loja' OR EXISTS (SELECT 1 FROM loja_clube_produtos x
                    WHERE x.parceiro_id = lc.parceiro_id AND x.catalogo = '${catalogo}' AND x.item_id = ${itemId})))`;
}

// Benefício da loja para o pedido (com cache no ctx do pedido).
async function clubeDaLoja(ctx, parceiroId) {
  if (!PRECO_LOJA_CLUBE_NO_SITE) return null;
  ctx.clubeLojas = ctx.clubeLojas || new Map();
  if (ctx.clubeLojas.has(parceiroId)) return ctx.clubeLojas.get(parceiroId);
  const b = (await db.query(`SELECT percentual, alcance, entrega_gratis FROM loja_clube WHERE parceiro_id = $1 AND ativo`, [parceiroId])).rows[0];
  let clube = null;
  if (b) {
    const escolhidos = b.alcance === 'escolhidos'
      ? new Set((await db.query(`SELECT catalogo, item_id FROM loja_clube_produtos WHERE parceiro_id = $1`, [parceiroId])).rows.map(r => `${r.catalogo}:${r.item_id}`))
      : null;
    clube = { percentual: b.percentual != null ? Number(b.percentual) : null, alcance: b.alcance, entrega_gratis: b.entrega_gratis, escolhidos };
  }
  ctx.clubeLojas.set(parceiroId, clube);
  return clube;
}

// Percentual que vale para um item (null = não vale).
// Loja toda: vale para qualquer item (inclusive promoção sem produto ligado);
// produtos escolhidos: só para os marcados (mesma regra do sqlClubePct).
function pctDoItem(clube, catalogo, itemId) {
  if (!clube || clube.percentual == null) return null;
  if (clube.alcance === 'escolhidos' && !(itemId && clube.escolhidos.has(`${catalogo}:${itemId}`))) return null;
  return clube.percentual;
}

module.exports = { precoComClube, sqlClubePct, clubeDaLoja, pctDoItem };

// Menor preço Clube de um produto (preço fixo ou percentual da loja), ou
// null. Para as mensagens de WhatsApp e a "Minha lista".
function precoClubeProduto({ preco, preco_associado: fixo, clube_pct: pct }) {
  const c = [fixo != null ? Number(fixo) : null, pct != null && preco != null ? precoComClube(preco, pct) : null].filter(v => v != null && v > 0);
  return c.length ? Math.min(...c) : null;
}
// Promoção: preço fixo da promoção ou percentual sobre o preço "de".
function precoClubePromocao({ preco_de: de, preco_associado: fixo, clube_pct: pct }) {
  const c = [fixo != null ? Number(fixo) : null, pct != null && de != null ? precoComClube(de, pct) : null].filter(v => v != null && v > 0);
  return c.length ? Math.min(...c) : null;
}

module.exports.precoClubeProduto = precoClubeProduto;
module.exports.precoClubePromocao = precoClubePromocao;

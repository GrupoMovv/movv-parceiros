// Quem alterou a chave PIX de um parceiro (tabela partner_pix_historico,
// migration 090). Chamar dentro da mesma transação do UPDATE, com o valor
// lido antes (SELECT ... FOR UPDATE). Só grava se a chave mudou de verdade.
const { nomeDoAdmin } = require('./registroAdmin');

const limpa = v => (v == null ? '' : String(v).trim());

async function registrarTrocaPix(cx, partnerId, antes, depois, user) {
  if (limpa(antes) === limpa(depois)) return false;
  await cx.query(
    `INSERT INTO partner_pix_historico (partner_id, campo, valor_antes, valor_depois, alterado_por_id, alterado_por_nome)
     VALUES ($1, 'pix_key', $2, $3, $4, $5)`,
    [partnerId, limpa(antes) || null, limpa(depois) || null, user?.id || null, nomeDoAdmin(user)]
  );
  return true;
}

// Trecho de SQL com a última troca de chave PIX dos últimos 7 dias do
// parceiro `alias`.id: colunas pix_alterada_em e pix_alterada_por.
const JOIN_PIX_RECENTE = alias => `LEFT JOIN LATERAL (
    SELECT h.criado_em, h.alterado_por_nome FROM partner_pix_historico h
    WHERE h.partner_id = ${alias}.id AND h.campo = 'pix_key' AND h.criado_em > NOW() - INTERVAL '7 days'
    ORDER BY h.criado_em DESC, h.id DESC LIMIT 1
  ) pixh ON true`;
const COLUNAS_PIX_RECENTE = 'pixh.criado_em AS pix_alterada_em, pixh.alterado_por_nome AS pix_alterada_por';

module.exports = { registrarTrocaPix, JOIN_PIX_RECENTE, COLUNAS_PIX_RECENTE };

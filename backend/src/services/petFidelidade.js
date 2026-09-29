const crypto = require('crypto');
const db = require('../config/database');
const { hojeSP } = require('../config/pet');

// Pet parte 5 — atendimento realizado (QR nos dois sentidos) e cartão
// fidelidade POR PET, definido pelo pet shop. Regras (Junior, 28/09/2026):
//  - pet shop leu o QR do pet (ou "Marcar como realizado") → vale na hora,
//    carimba; o dono pode contestar ("não fui eu") e o carimbo sai
//  - cliente leu o QR do balcão → aguardando_loja; só carimba quando o pet
//    shop confirmar (senão uma foto do QR daria carimbo infinito em casa)
//  - 1 atendimento valendo por pet/dia/pet shop
//  - cartão completo → prêmio disponível por 90 dias; pet shop resgata

const DIAS_VALIDADE_PREMIO = 90;

const novoToken = () => crypto.randomBytes(18).toString('base64url');

// Token do QR, criado na 1ª vez (update condicional: 2 pedidos ao mesmo
// tempo ficam com o mesmo token)
async function tokenDoPet(petId) {
  await db.query('UPDATE pets SET qr_token = $1 WHERE id = $2 AND qr_token IS NULL', [novoToken(), petId]);
  return (await db.query('SELECT qr_token FROM pets WHERE id = $1', [petId])).rows[0]?.qr_token;
}
async function tokenDaLoja(parceiroId) {
  await db.query('UPDATE sindicato_parceiros SET pet_qr_token = $1 WHERE id = $2 AND pet_qr_token IS NULL', [novoToken(), parceiroId]);
  return (await db.query('SELECT pet_qr_token FROM sindicato_parceiros WHERE id = $1', [parceiroId])).rows[0]?.pet_qr_token;
}

// Cartão que vale pra este serviço: o do serviço; se não tiver, o geral.
async function cartaoPara(client, parceiroId, servico) {
  const r = await client.query(
    `SELECT * FROM pet_fidelidade_cartoes WHERE parceiro_id = $1 AND ativo = true AND (servico = $2 OR servico IS NULL)
     ORDER BY (servico IS NULL) LIMIT 1`, [parceiroId, servico]
  );
  return r.rows[0] || null;
}

// Carimba um atendimento confirmado. Fecha o cartão se completou.
// → { cartao, carimbos, meta, premio } | null (pet shop sem cartão)
async function carimbar(client, atendimento) {
  const cartao = await cartaoPara(client, atendimento.parceiro_id, atendimento.servico);
  if (!cartao) return null;
  await client.query(
    'INSERT INTO pet_fidelidade_carimbos (cartao_id, pet_id, atendimento_id) VALUES ($1, $2, $3) ON CONFLICT (atendimento_id) DO NOTHING',
    [cartao.id, atendimento.pet_id, atendimento.id]
  );
  const abertos = (await client.query(
    'SELECT id FROM pet_fidelidade_carimbos WHERE cartao_id = $1 AND pet_id = $2 AND premio_id IS NULL ORDER BY id', [cartao.id, atendimento.pet_id]
  )).rows;
  let premio = null;
  if (abertos.length >= cartao.meta) {
    premio = (await client.query(
      `INSERT INTO pet_fidelidade_premios (cartao_id, pet_id, premio_texto, expira_em)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval) RETURNING *`,
      [cartao.id, atendimento.pet_id, cartao.premio, String(DIAS_VALIDADE_PREMIO)]
    )).rows[0];
    await client.query('UPDATE pet_fidelidade_carimbos SET premio_id = $1 WHERE id = ANY($2)', [premio.id, abertos.slice(0, cartao.meta).map(c => c.id)]);
  }
  return { cartao, carimbos: premio ? 0 : abertos.length, meta: cartao.meta, premio };
}

// Tira o carimbo de um atendimento contestado/recusado — só se ainda não
// virou prêmio. → true | false (já fechou cartão)
async function descarimbar(client, atendimentoId) {
  const c = (await client.query('SELECT premio_id FROM pet_fidelidade_carimbos WHERE atendimento_id = $1', [atendimentoId])).rows[0];
  if (c?.premio_id) return false;
  await client.query('DELETE FROM pet_fidelidade_carimbos WHERE atendimento_id = $1', [atendimentoId]);
  return true;
}

// Registra o atendimento de hoje. origem 'loja_leu' confirma e carimba na
// hora; 'cliente_leu' fica aguardando a loja. Liga ao pedido do IUB se o pet
// tinha horário confirmado hoje nesse pet shop.
// → { atendimento, fidelidade } | { erro, status }
// `agendamentoId`/`dia`: "Marcar como realizado" de um pedido (o dia é o do pedido).
async function registrarAtendimento({ pet, parceiroId, servico, origem, agendamentoId = null, dia = hojeSP() }) {
  try {
    return await db.transacao(async client => {
      const ag = agendamentoId ? { id: agendamentoId } : (await client.query(
        `SELECT id FROM pet_agendamentos WHERE pet_id = $1 AND parceiro_id = $2 AND status = 'confirmado' AND data = $3 ORDER BY id LIMIT 1`,
        [pet.id, parceiroId, dia]
      )).rows[0];
      const confirmaJa = origem === 'loja_leu';
      const at = (await client.query(
        `INSERT INTO pet_atendimentos (pet_id, parceiro_id, associado_id, servico, dia, origem, status, agendamento_id, confirmado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${confirmaJa ? 'NOW()' : 'NULL'}) RETURNING *`,
        [pet.id, parceiroId, pet.associado_id, servico, dia, origem, confirmaJa ? 'confirmado' : 'aguardando_loja', ag?.id || null]
      )).rows[0];
      const fidelidade = confirmaJa ? await carimbar(client, at) : null;
      return { atendimento: at, fidelidade };
    });
  } catch (err) {
    if (err.code === '23505') return { erro: `O atendimento de hoje do ${pet.nome} aqui já foi registrado`, status: 409 };
    throw err;
  }
}

// Pet shop confirma um "cliente_leu" → carimba
async function confirmarAtendimento(atendimento) {
  return db.transacao(async client => {
    const at = (await client.query(
      "UPDATE pet_atendimentos SET status = 'confirmado', confirmado_em = NOW() WHERE id = $1 AND status = 'aguardando_loja' RETURNING *", [atendimento.id]
    )).rows[0];
    if (!at) return null;
    return { atendimento: at, fidelidade: await carimbar(client, at) };
  });
}

// Progresso de um pet em todos os cartões (ou só nos de um pet shop).
async function progressoDoPet(petId, parceiroId = null) {
  const cartoes = (await db.query(
    `SELECT c.id, c.parceiro_id, c.servico, c.meta, c.premio, p.nome AS parceiro_nome, p.slug AS parceiro_slug,
            (SELECT COUNT(*)::int FROM pet_fidelidade_carimbos k WHERE k.cartao_id = c.id AND k.pet_id = $1 AND k.premio_id IS NULL) AS carimbos
     FROM pet_fidelidade_cartoes c JOIN sindicato_parceiros p ON p.id = c.parceiro_id
     WHERE c.ativo = true AND ($2::int IS NULL OR c.parceiro_id = $2)
       AND (EXISTS (SELECT 1 FROM pet_fidelidade_carimbos k WHERE k.cartao_id = c.id AND k.pet_id = $1)
            OR $2::int IS NOT NULL)
     ORDER BY p.nome, c.servico NULLS LAST`, [petId, parceiroId]
  )).rows;
  const premios = (await db.query(
    `SELECT pr.id, pr.premio_texto, pr.disponivel_em, pr.expira_em, pr.resgatado_em, c.parceiro_id, p.nome AS parceiro_nome
     FROM pet_fidelidade_premios pr JOIN pet_fidelidade_cartoes c ON c.id = pr.cartao_id JOIN sindicato_parceiros p ON p.id = c.parceiro_id
     WHERE pr.pet_id = $1 AND ($2::int IS NULL OR c.parceiro_id = $2)
       AND (pr.resgatado_em IS NULL AND pr.expira_em > NOW() OR pr.resgatado_em > NOW() - INTERVAL '30 days')
     ORDER BY pr.disponivel_em DESC`, [petId, parceiroId]
  )).rows;
  return { cartoes, premios };
}

module.exports = {
  DIAS_VALIDADE_PREMIO, tokenDoPet, tokenDaLoja, registrarAtendimento, confirmarAtendimento, descarimbar, progressoDoPet,
};

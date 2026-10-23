// Indicação duplicada (migration 103, Junior 23/10/2026).
// - Mesmo CPF/CNPJ + mesmo produto: ganha quem indicou primeiro.
// - Protege: pendente com menos de 30 dias, OU com contrato, OU com
//   lançamento não estornado, OU convertida; nunca expirada nem cancelada.
// - Partner barrado recebe SEMPRE a mesma mensagem (sem dizer quem nem
//   quando) e a tentativa fica registrada com o documento mascarado + HMAC.
// - Mais de 5 tentativas barradas em 24 h: toda indicação seguinte do
//   Partner recebe a mesma mensagem (não dá para "testar" CPFs).
// - A equipe libera uma tentativa (motivo obrigatório): a próxima indicação
//   do mesmo Partner, produto e documento passa.
// Corrida: tudo dentro de UMA transação, com pg_advisory_xact_lock por
// documento + produto; o protocolo também sai sob trava (protocolService).
// CPF/CNPJ inteiro nunca vai para log, mensagem de erro nem admin_acoes.
const crypto = require('crypto');
const { onlyDigits, isValidCPF, isValidCNPJ, mascararDocumento } = require('../utils/validators');

const MSG_DUPLICADA = 'Este cliente já tem uma indicação em andamento para este produto. Fale com a Central Movv.';
const LIMITE_TENTATIVAS_24H = 5;
const DIAS_PROTECAO = 30;

// CPF ou CNPJ no mesmo campo. Devolve { documento } (só dígitos ou null) ou { erro }.
function documentoDaIndicacao(valor, { obrigatorio = false } = {}) {
  const d = onlyDigits(valor ?? '');
  if (!d) return obrigatorio ? { erro: 'Informe o CPF ou CNPJ do cliente.' } : { documento: null };
  if (d.length === 11 && isValidCPF(d)) return { documento: d };
  if (d.length === 14 && isValidCNPJ(d)) return { documento: d };
  return { erro: 'CPF ou CNPJ do cliente inválido.' };
}

// HMAC: compara tentativas sem guardar o documento (um SHA-256 puro de CPF
// se quebra por força bruta)
function hashDocumento(documento) {
  const segredo = process.env.DOCUMENTO_HASH_SECRET || process.env.JWT_SECRET;
  if (!segredo) throw new Error('DOCUMENTO_HASH_SECRET/JWT_SECRET ausente');
  return crypto.createHmac('sha256', segredo).update(`documento:${documento}`).digest('hex');
}

async function travarDocumentoProduto(cx, documento, productId) {
  await cx.query(`SELECT pg_advisory_xact_lock(hashtext('referral_documento'), hashtext($1))`, [`${documento}:${productId}`]);
}

// Indicação que protege o cliente neste produto (a mais antiga), ou null
async function indicacaoQueProtege(cx, documento, productId) {
  return (await cx.query(
    `SELECT r.id, r.protocol, r.partner_id, r.created_at
     FROM referrals r
     WHERE r.client_documento = $1 AND r.product_id = $2
       AND r.status NOT IN ('expired', 'cancelled')
       AND (   (r.status = 'pending' AND r.created_at > NOW() - make_interval(days => ${DIAS_PROTECAO}))
            OR r.numero_contrato IS NOT NULL
            OR r.status = 'converted'
            OR EXISTS (SELECT 1 FROM partner_comissoes pc WHERE pc.referral_id = r.id AND pc.status <> 'estornado'))
     ORDER BY r.created_at, r.id
     LIMIT 1`,
    [documento, productId]
  )).rows[0] || null;
}

async function registrarTentativa(cx, { partnerId, productId, documento, hash, motivo, bloqueadoraId = null }) {
  await cx.query(
    `INSERT INTO referral_tentativas_bloqueadas
       (partner_id, product_id, documento_mascarado, documento_hash, motivo, referral_bloqueadora_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [partnerId, productId, mascararDocumento(documento), hash, motivo, bloqueadoraId]
  );
}

// Indicação feita pelo PRÓPRIO Partner. Chamar dentro da transação, antes do
// INSERT. Devolve { bloqueada: true } (tentativa já registrada) ou
// { bloqueada: false, liberacaoId } (liberacaoId: tentativa liberada que
// está sendo usada agora; marcar com marcarLiberacaoUsada depois do INSERT).
async function checarIndicacaoDoPartner(cx, { partnerId, productId, documento }) {
  await travarDocumentoProduto(cx, documento, productId);
  const hash = hashDocumento(documento);

  const liberada = (await cx.query(
    `SELECT id FROM referral_tentativas_bloqueadas
     WHERE partner_id = $1 AND product_id = $2 AND documento_hash = $3
       AND liberada_em IS NOT NULL AND usada_em IS NULL
     ORDER BY liberada_em LIMIT 1 FOR UPDATE`,
    [partnerId, productId, hash]
  )).rows[0];
  if (liberada) return { bloqueada: false, liberacaoId: liberada.id };

  const recentes = Number((await cx.query(
    `SELECT COUNT(*) AS n FROM referral_tentativas_bloqueadas
     WHERE partner_id = $1 AND liberada_em IS NULL AND criado_em > NOW() - INTERVAL '24 hours'`,
    [partnerId]
  )).rows[0].n);
  if (recentes >= LIMITE_TENTATIVAS_24H) {
    await registrarTentativa(cx, { partnerId, productId, documento, hash, motivo: 'limite' });
    return { bloqueada: true };
  }

  const dona = await indicacaoQueProtege(cx, documento, productId);
  if (dona) {
    await registrarTentativa(cx, { partnerId, productId, documento, hash, motivo: 'duplicidade', bloqueadoraId: dona.id });
    return { bloqueada: true };
  }
  return { bloqueada: false, liberacaoId: null };
}

async function marcarLiberacaoUsada(cx, liberacaoId, referralId) {
  await cx.query(
    `UPDATE referral_tentativas_bloqueadas SET usada_em = NOW(), referral_liberada_id = $2 WHERE id = $1`,
    [liberacaoId, referralId]
  );
}

// ─── Equipe ─────────────────────────────────────────────────────────────────

async function listarTentativas(cx, { limite = 300 } = {}) {
  return (await cx.query(
    `SELECT t.id, t.criado_em, t.motivo, t.documento_mascarado,
            t.liberada_em, t.liberada_por, t.motivo_liberacao, t.usada_em,
            p.id AS partner_id, p.name AS partner_nome, p.code AS partner_codigo,
            pr.name AS produto,
            rb.id AS bloqueadora_id, rb.protocol AS bloqueadora_protocolo, rb.created_at AS bloqueadora_em,
            rb.status AS bloqueadora_status, rb.numero_contrato AS bloqueadora_contrato,
            pb.name AS bloqueadora_partner_nome, pb.code AS bloqueadora_partner_codigo,
            rl.protocol AS liberada_protocolo
     FROM referral_tentativas_bloqueadas t
     JOIN partners p ON p.id = t.partner_id
     JOIN products pr ON pr.id = t.product_id
     LEFT JOIN referrals rb ON rb.id = t.referral_bloqueadora_id
     LEFT JOIN partners pb ON pb.id = rb.partner_id
     LEFT JOIN referrals rl ON rl.id = t.referral_liberada_id
     ORDER BY t.criado_em DESC, t.id DESC
     LIMIT $1`,
    [limite]
  )).rows;
}

// Devolve os dados (mascarados) para o registro em admin_acoes, ou null se
// a tentativa não existe / já foi liberada.
async function liberarTentativa(cx, id, motivo, quem) {
  return (await cx.query(
    `UPDATE referral_tentativas_bloqueadas
        SET liberada_em = NOW(), liberada_por = $3, motivo_liberacao = $2
      WHERE id = $1 AND liberada_em IS NULL
      RETURNING id, partner_id, product_id, documento_mascarado, motivo`,
    [id, motivo, quem]
  )).rows[0] || null;
}

module.exports = {
  MSG_DUPLICADA, LIMITE_TENTATIVAS_24H, DIAS_PROTECAO,
  documentoDaIndicacao, hashDocumento, indicacaoQueProtege, checarIndicacaoDoPartner,
  travarDocumentoProduto, marcarLiberacaoUsada, listarTentativas, liberarTentativa,
};

// Protocolo da indicação: MOV-AAAA-NNNNNN. Antes contava as indicações do
// ano fora de transação: dois cadastros ao mesmo tempo pegavam o mesmo
// número e um deles caía no UNIQUE (erro 500). Agora sai sob trava
// (pg_advisory_xact_lock) e pelo MAIOR número do ano, dentro da MESMA
// transação do INSERT — a trava só é solta no COMMIT/ROLLBACK.
async function generateProtocol(cx) {
  if (!cx) throw new Error('generateProtocol precisa da transação do INSERT');
  const year = new Date().getFullYear();
  await cx.query(`SELECT pg_advisory_xact_lock(hashtext('referral_protocolo'))`);
  const result = await cx.query(
    `SELECT COALESCE(MAX(SUBSTRING(protocol FROM '^MOV-[0-9]{4}-([0-9]+)$')::int), 0) AS ultimo
     FROM referrals WHERE protocol LIKE $1`,
    [`MOV-${year}-%`]
  );
  const sequence = Number(result.rows[0].ultimo) + 1;
  const paddedSeq = String(sequence).padStart(6, '0');
  return `MOV-${year}-${paddedSeq}`;
}

function getExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}

module.exports = { generateProtocol, getExpirationDate };

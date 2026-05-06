const db = require('../config/database');

async function generateProtocol() {
  const year = new Date().getFullYear();
  const result = await db.query(
    "SELECT COUNT(*) as count FROM referrals WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const sequence = parseInt(result.rows[0].count) + 1;
  const paddedSeq = String(sequence).padStart(6, '0');
  return `MOV-${year}-${paddedSeq}`;
}

function getExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}

module.exports = { generateProtocol, getExpirationDate };

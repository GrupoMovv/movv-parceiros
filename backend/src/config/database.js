const { Pool, types } = require('pg');
require('dotenv').config();

// node-postgres por padrão converte a coluna DATE (OID 1082) num JS Date
// à meia-noite no fuso LOCAL do processo, que muda de dia dependendo do
// fuso do servidor — desliga isso e devolve sempre a string "YYYY-MM-DD"
// crua que o Postgres já manda, sem ambiguidade de fuso nenhuma. Datas de
// verdade (TIMESTAMPTZ) não são afetadas, continuam vindo como Date.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL', err);
  process.exit(-1);
});

// Transação de verdade. NÃO usar db.query('BEGIN') / db.query('COMMIT'):
// db.query vai pro pool e cada chamada pode cair numa conexão diferente — o
// BEGIN abre numa, os INSERTs rodam em outras (autocommit) e o ROLLBACK não
// desfaz nada. Aqui tudo roda no mesmo `client`:
//   const r = await db.transacao(async (client) => { await client.query(...); return x; });
// Se `fn` lançar, faz ROLLBACK e relança o erro.
async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  transacao,
};

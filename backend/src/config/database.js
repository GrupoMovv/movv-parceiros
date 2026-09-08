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

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

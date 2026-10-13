// Banco de teste: Postgres de verdade em memória (PGlite, sem servidor), com
// todas as migrations de backend/migrations aplicadas em ordem. Nada aqui
// toca o DATABASE_URL — os testes nunca falam com produção.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../migrations');

async function novoBanco() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
  // DATE volta como texto "AAAA-MM-DD", igual a src/config/database.js
  const pg = new PGlite({ extensions: { uuid_ossp }, parsers: { 1082: v => v } });
  const arquivos = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
  for (const f of arquivos) {
    try {
      await pg.exec(fs.readFileSync(path.join(DIR, f), 'utf8'));
    } catch (err) {
      throw new Error(`migration ${f}: ${err.message}`);
    }
  }
  // mesma interface do pg (query(text, params) -> { rows }) e transacao(fn)
  const db = {
    query: (text, params) => pg.query(text, params),
    transacao: fn => pg.transaction(tx => fn({ query: (t, p) => tx.query(t, p) })),
    fechar: () => pg.close(),
  };
  return db;
}

// Troca src/config/database por este banco antes de carregar o app (testes
// de API e o servidor de teste local). Chamar ANTES de require('../src/app').
function usarNoApp(banco) {
  const arquivo = require.resolve(path.join(__dirname, '../../src/config/database'));
  require.cache[arquivo] = {
    id: arquivo, filename: arquivo, loaded: true,
    exports: {
      query: banco.query,
      transacao: banco.transacao,
      pool: { connect: async () => ({ query: banco.query, release() {} }) },
    },
  };
}

module.exports = { novoBanco, usarNoApp };

// Apaga as lojas criadas por lojas_teste_criar.js e tudo ligado a elas
// (produtos, promoções, preços pet, pedidos, agendamentos...). Só toca em
// lojas com empresa_teste = true E slug da lista abaixo. A Adega Teste IUB
// (parceiro 47) nunca entra.
//
//   node scripts/lojas_teste_limpar.js            -> mostra o que vai apagar (não apaga)
//   node scripts/lojas_teste_limpar.js --apagar   -> apaga
require('dotenv').config();
const db = require('../src/config/database');

const SLUGS = ['pet-teste-iub', 'servico-teste-iub', 'mercado-teste-iub'];

// Tabelas que apontam para a loja (direto ou por um pedido/agendamento) e
// precisam sair antes dela. As que têm ON DELETE CASCADE saem sozinhas.
async function dependencias(c, ids) {
  const fks = (await c.query(`
    SELECT cl.relname AS tabela, a.attname AS coluna, con.confdeltype AS ao_apagar
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.confrelid = 'sindicato_parceiros'::regclass`)).rows;
  const contagem = [];
  for (const fk of fks) {
    const n = (await c.query(`SELECT COUNT(*)::int AS n FROM ${fk.tabela} WHERE ${fk.coluna} = ANY($1)`, [ids])).rows[0].n;
    if (n) contagem.push({ ...fk, n });
  }
  return contagem;
}

async function main() {
  const apagar = process.argv.includes('--apagar');
  const lojas = (await db.query(
    'SELECT id, slug, nome FROM sindicato_parceiros WHERE empresa_teste AND slug = ANY($1) AND id <> 47 ORDER BY id', [SLUGS]
  )).rows;
  if (!lojas.length) { console.log('Nenhuma loja de teste da lista encontrada. Nada a fazer.'); return; }
  const ids = lojas.map(l => l.id);
  console.table(lojas);
  const deps = await dependencias(db, ids);
  console.log('Ligado a essas lojas:');
  console.table(deps.map(d => ({ tabela: d.tabela, linhas: d.n, sai_junto: d.ao_apagar === 'c' ? 'sim (cascade)' : 'apagado antes' })));
  if (!apagar) { console.log('Nada foi apagado. Use --apagar para apagar.'); return; }

  await db.transacao(async (c) => {
    // pedidos: itens e avisos saem em cascata com o pedido
    for (const d of deps.filter(x => x.ao_apagar !== 'c')) {
      await c.query(`DELETE FROM ${d.tabela} WHERE ${d.coluna} = ANY($1)`, [ids]);
    }
    // histórico de preços (migration 083) não tem chave estrangeira: sai à parte
    const h = await c.query("SELECT to_regclass('precos_historico') IS NOT NULL AS existe");
    if (h.rows[0].existe) await c.query('DELETE FROM precos_historico WHERE parceiro_id = ANY($1)', [ids]);
    const r = await c.query('DELETE FROM sindicato_parceiros WHERE id = ANY($1) AND empresa_teste AND id <> 47', [ids]);
    console.log(`Apagadas ${r.rowCount} lojas de teste e tudo ligado a elas.`);
  });
}

main().then(() => db.pool.end()).catch(e => { console.error('FALHOU, nada foi apagado:', e.message); db.pool.end(); process.exit(1); });

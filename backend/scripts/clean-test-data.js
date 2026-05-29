/**
 * clean-test-data.js — Remove TODOS os dados de teste do banco.
 *
 * PRESERVA:
 *   - products          (21 produtos da Azul — intocados)
 *   - partners id=1     (admin ADMIN-001)
 *   - internal_collaborators (Pabline id=1, Fernando id=2)
 *
 * USO LOCAL:
 *   cd backend && node scripts/clean-test-data.js
 *
 * NO RENDER (Shell):
 *   node scripts/clean-test-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool }    = require('pg');
const readline    = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function countAll(client) {
  const tables = [
    'products', 'partners', 'referrals', 'commissions', 'payments',
    'interest_submissions', 'internal_collaborators', 'internal_commissions',
    'indicators', 'indicator_referrals', 'indicator_payments',
  ];
  const counts = {};
  for (const t of tables) {
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    counts[t] = r.rows[0].n;
  }
  return counts;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não definida.');
    process.exit(1);
  }

  console.log('');
  console.log('!! ATENCAO - DELECAO IRREVERSIVEL !!');
  console.log('');
  console.log('Este script vai APAGAR todos os dados de teste.');
  console.log('Sera mantido APENAS:');
  console.log('  - Admin (ADMIN-001)');
  console.log('  - Pabline e Fernando (internal_collaborators)');
  console.log('  - Todos os produtos da Azul');
  console.log('');
  console.log('Digite SIM (em maiusculas) e pressione ENTER para continuar:');

  const resposta = await ask('> ');

  if (resposta.trim() !== 'SIM') {
    console.log('\nOperacao cancelada. Nenhum dado foi alterado.');
    process.exit(0);
  }

  const client = await pool.connect();
  console.log('\nConectado ao banco. Executando limpeza...\n');

  try {
    // Contagem antes
    console.log('--- ANTES ---');
    const antes = await countAll(client);
    for (const [t, n] of Object.entries(antes)) {
      console.log(`  ${t.padEnd(30)} ${String(n).padStart(6)} linhas`);
    }
    console.log('');

    await client.query('BEGIN');
    await client.query("SET session_replication_role = 'replica'");

    // Tabelas transacionais — apaga tudo e reseta sequences
    const truncateTables = [
      'indicator_payments',
      'indicator_referrals',
      'indicators',
      'internal_commissions',
      'interest_submissions',
      'payments',
      'commissions',
      'referrals',
    ];

    for (const t of truncateTables) {
      await client.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
      console.log(`  TRUNCATE ${t}`);
    }

    // Partners: apaga tudo exceto o admin
    const delResult = await client.query(
      'DELETE FROM partners WHERE is_admin IS NOT TRUE'
    );
    console.log(`  DELETE partners (removidos: ${delResult.rowCount})`);

    // Reinicia sequence do partners para o id atual do admin
    await client.query(
      `SELECT setval('partners_id_seq', (SELECT MAX(id) FROM partners))`
    );

    await client.query("SET session_replication_role = 'DEFAULT'");
    await client.query('COMMIT');

    // Contagem depois
    console.log('\n--- DEPOIS ---');
    const depois = await countAll(client);
    for (const [t, n] of Object.entries(depois)) {
      const tag = ['products', 'partners', 'internal_collaborators'].includes(t)
        ? ' (mantido)'
        : '';
      console.log(`  ${t.padEnd(30)} ${String(n).padStart(6)} linhas${tag}`);
    }

    console.log('\n========================================');
    console.log('Limpeza concluida com sucesso!');
    console.log(`  products              : ${depois['products']} (intocados)`);
    console.log(`  partners              : ${depois['partners']} (so o admin)`);
    console.log(`  internal_collaborators: ${depois['internal_collaborators']} (Pabline e Fernando)`);
    console.log('========================================');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nERRO — transacao revertida:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

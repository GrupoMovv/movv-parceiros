/**
 * backup-database.js — Exporta todas as tabelas do PostgreSQL em formato SQL.
 *
 * USO LOCAL:
 *   cd backend
 *   node scripts/backup-database.js
 *
 * NO RENDER (via Shell):
 *   DATABASE_URL="..." node scripts/backup-database.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Ordem de inserção respeitando FKs (tabelas sem deps primeiro)
const TABLE_ORDER = [
  'products',
  'partners',
  'referrals',
  'commissions',
  'payments',
  'interest_submissions',
  'internal_collaborators',
  'internal_commissions',
  'indicators',
  'indicator_referrals',
  'indicator_payments',
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

// Escapa valores para SQL seguro
function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;

  // Arrays do PostgreSQL (integer[], text[], etc.)
  if (Array.isArray(val)) {
    if (val.length === 0) return "'{}'";
    const inner = val.map(v => {
      if (v === null) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `"${String(v).replace(/"/g, '\\"')}"`;
    }).join(',');
    return `'{${inner}}'`;
  }

  // Objetos (JSONB)
  if (typeof val === 'object') {
    const json = JSON.stringify(val).replace(/'/g, "''");
    return `'${json}'`;
  }

  // String — escapa aspas simples
  return `'${String(val).replace(/'/g, "''")}'`;
}

function nowFormatted() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function getAllTables(client) {
  const res = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return res.rows.map(r => r.tablename);
}

async function getSequences(client) {
  const res = await client.query(`
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `);
  return res.rows.map(r => r.sequence_name);
}

async function exportTable(client, tableName) {
  const res = await client.query(`SELECT * FROM "${tableName}"`);
  if (res.rows.length === 0) return { sql: `-- Tabela ${tableName}: vazia\n`, count: 0 };

  const cols = res.fields.map(f => `"${f.name}"`).join(', ');
  const lines = [`-- Tabela: ${tableName} (${res.rows.length} linhas)`];

  // Insere em lotes de 500 para não gerar linhas enormes
  const BATCH = 500;
  for (let i = 0; i < res.rows.length; i += BATCH) {
    const batch = res.rows.slice(i, i + BATCH);
    const values = batch
      .map(row => `  (${res.fields.map(f => sqlValue(row[f.name])).join(', ')})`)
      .join(',\n');
    lines.push(`INSERT INTO "${tableName}" (${cols}) VALUES\n${values}\nON CONFLICT DO NOTHING;`);
  }

  return { sql: lines.join('\n') + '\n', count: res.rows.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não definida. Configure no .env ou exporte a variável.');
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const filename = `backup-${nowFormatted()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const client = await pool.connect();
  console.log('Conectado ao banco. Iniciando backup...\n');

  try {
    const allTables   = await getAllTables(client);
    const sequences   = await getSequences(client);

    // Une tabelas conhecidas + quaisquer extras encontradas no banco
    const extraTables = allTables.filter(t => !TABLE_ORDER.includes(t));
    const orderedTables = [...TABLE_ORDER.filter(t => allTables.includes(t)), ...extraTables];

    const stats = {};
    const sections = [];

    // Cabeçalho
    const dbName = new URL(process.env.DATABASE_URL).pathname.replace('/', '');
    sections.push(
      `-- ============================================================`,
      `-- Movv Parceiros — Backup Completo`,
      `-- Gerado em : ${new Date().toISOString()}`,
      `-- Banco     : ${dbName}`,
      `-- Tabelas   : ${orderedTables.join(', ')}`,
      `-- ============================================================`,
      ``,
      `BEGIN;`,
      ``,
      `-- Desabilita verificação de FK durante o restore`,
      `SET session_replication_role = 'replica';`,
      ``,
    );

    // Truncate na ordem inversa (respeita FKs)
    sections.push(`-- Limpa tabelas antes de inserir (comente se quiser apenas append)`);
    [...orderedTables].reverse().forEach(t => {
      sections.push(`TRUNCATE TABLE "${t}" CASCADE;`);
    });
    sections.push('');

    // Dados de cada tabela
    for (const table of orderedTables) {
      process.stdout.write(`  Exportando ${table.padEnd(30)}...`);
      const { sql, count } = await exportTable(client, table);
      stats[table] = count;
      sections.push(sql);
      console.log(` ${count} linhas`);
    }

    // Reinicia sequences para o MAX(id) de cada tabela
    sections.push('-- Reinicia sequences após inserção');
    for (const seq of sequences) {
      // Tenta detectar a qual tabela/coluna pertence esta sequence
      const match = seq.match(/^(.+)_id_seq$/);
      if (match) {
        const table = match[1];
        if (allTables.includes(table)) {
          sections.push(
            `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 1));`
          );
        }
      }
    }

    sections.push('');
    sections.push(`SET session_replication_role = 'DEFAULT';`);
    sections.push(`COMMIT;`);
    sections.push('');
    sections.push(`-- Fim do backup — ${new Date().toISOString()}`);

    fs.writeFileSync(filepath, sections.join('\n'), 'utf8');

    // Estatísticas finais
    const size = fs.statSync(filepath).size;
    const sizeStr = size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(1)} KB`;

    console.log('\n========================================');
    console.log(`Arquivo : ${filepath}`);
    console.log(`Tamanho : ${sizeStr}`);
    console.log('');
    console.log('Linhas por tabela:');
    Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => console.log(`  ${t.padEnd(30)} ${String(n).padStart(6)} linhas`));
    console.log('========================================');
    console.log('Backup concluído com sucesso!');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nERRO no backup:', err.message);
  process.exit(1);
});

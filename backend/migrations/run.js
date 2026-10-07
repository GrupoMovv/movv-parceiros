require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');

// Roda só as migrations que ainda não foram aplicadas e registra cada uma em
// schema_migrations (o Build Command do Render chama este arquivo a cada
// deploy). Antes de 07/10/2026 rodava TODAS de novo a cada deploy — a 080
// recriava um índice que a 081 tinha trocado e o build quebrou.
//
// Primeira vez num banco que já existia (produção): as migrations até
// ULTIMA_DO_REGIME_ANTIGO já estão aplicadas — só são registradas, sem rodar.
// Banco novo (vazio): roda todas, do 001 em diante.
//
// Corrigir migration antiga não tem mais efeito: crie um arquivo novo.
// O checksum só serve de aviso se um arquivo já aplicado for alterado.

const DIR = process.env.MIGRATIONS_DIR || __dirname;
const ULTIMA_DO_REGIME_ANTIGO = '082_pedido_numeracao_1001.sql';
const TRAVA = 726108; // pg_advisory_lock: dois deploys ao mesmo tempo não rodam juntos

const checksum = sql => crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

async function run() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
  const client = await db.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [TRAVA]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      arquivo      VARCHAR(200) PRIMARY KEY,
      checksum     VARCHAR(64),
      aplicada_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      como         VARCHAR(10) NOT NULL DEFAULT 'rodou'   -- 'rodou' ou 'registro' (já estava aplicada)
    )`);

    const registradas = (await client.query('SELECT arquivo, checksum FROM schema_migrations')).rows;
    if (registradas.length === 0) {
      // Banco que já existia? (loja_pedidos nasce na 080)
      const existia = (await client.query("SELECT to_regclass('public.loja_pedidos') IS NOT NULL AS sim")).rows[0].sim;
      if (existia) {
        const antigas = files.filter(f => f <= ULTIMA_DO_REGIME_ANTIGO);
        for (const f of antigas) {
          await client.query(
            "INSERT INTO schema_migrations (arquivo, checksum, como) VALUES ($1, $2, 'registro') ON CONFLICT DO NOTHING",
            [f, checksum(fs.readFileSync(path.join(DIR, f), 'utf8'))]
          );
        }
        console.log(`Primeira vez com registro: ${antigas.length} migrations já aplicadas registradas (até ${ULTIMA_DO_REGIME_ANTIGO}).`);
        registradas.push(...antigas.map(arquivo => ({ arquivo, checksum: null })));
      }
    }

    const feitas = new Map(registradas.map(r => [r.arquivo, r.checksum]));
    let novas = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      if (feitas.has(file)) {
        const antes = feitas.get(file);
        if (antes && antes !== checksum(sql)) console.warn(`⚠ ${file} foi alterada depois de aplicada — a mudança NÃO roda. Crie uma migration nova.`);
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (arquivo, checksum, como) VALUES ($1, $2, 'rodou')", [file, checksum(sql)]);
        await client.query('COMMIT');
        novas++;
        console.log(`✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`✗ ${file}: ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(novas ? `Migrations concluídas! (${novas} nova(s))` : 'Migrations concluídas! (nenhuma nova)');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [TRAVA]).catch(() => {});
    client.release();
  }
}

run()
  .then(() => db.pool.end())
  .then(() => process.exit(process.exitCode || 0))
  .catch(err => { console.error(err); process.exit(1); });

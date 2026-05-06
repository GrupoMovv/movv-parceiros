require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '001_initial.sql'), 'utf8');
  try {
    await db.query(sql);
    console.log('Migration executada com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('Erro na migration:', err.message);
    process.exit(1);
  }
}

run();

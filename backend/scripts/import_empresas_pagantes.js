// Importa a base de empresas pagantes (guia mensal do Sindicato) pro
// autocadastro público de associados. Upsert idempotente por CNPJ.
// Execute: node scripts/import_empresas_pagantes.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const { importarLista } = require('../src/services/contribuintesImportService');

const JSON_PATH = path.join(__dirname, 'data', 'empresas_pagantes.json.json');

async function run() {
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const { meta, empresas } = JSON.parse(raw);

  console.log(`Período: ${meta?.periodo || '?'} — ${empresas.length} empresas no arquivo`);

  const resumo = await importarLista(empresas);
  console.log(`Novas: ${resumo.novas} | Atualizadas: ${resumo.atualizadas} | Status mudou: ${resumo.status_mudou}`);
  console.log('Importação concluída!');
  process.exit(0);
}

run().catch(err => {
  console.error('Erro na importação:', err.message);
  process.exit(1);
});

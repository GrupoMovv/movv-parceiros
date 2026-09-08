/**
 * migrar-fotos-associados.js — Migra fotos de associado/dependente do disco
 * local (uploads/) pro Cloudinary. Precisa rodar ONDE os arquivos físicos
 * ainda existem — ou seja, no shell do Render, ANTES do próximo deploy (o
 * disco é apagado a cada deploy, é exatamente esse o bug que motivou o fix).
 *
 * Pra quem já perdeu a foto num deploy anterior (arquivo não existe mais):
 * marca foto_url como NULL — a carteirinha cai no fallback de iniciais em
 * vez de mostrar um link quebrado.
 *
 * USO:
 *   cd backend && node scripts/migrar-fotos-associados.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const fotoAssociadoService = require('../src/services/fotoAssociadoService');

async function migrarTabela({ label, tabela, uploadDir, uploadFn }) {
  const result = await db.query(
    `SELECT id, foto_url FROM ${tabela} WHERE foto_url LIKE '/uploads/%'`
  );

  let migrados = 0;
  let perdidos = 0;

  for (const row of result.rows) {
    const nomeArquivo = path.basename(row.foto_url);
    const caminhoLocal = path.join(uploadDir, nomeArquivo);

    if (!fs.existsSync(caminhoLocal)) {
      await db.query(`UPDATE ${tabela} SET foto_url = NULL, foto_public_id = NULL WHERE id = $1`, [row.id]);
      perdidos++;
      console.log(`  [${label} #${row.id}] arquivo não existe mais — foto_url zerada`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(caminhoLocal);
      const { url, publicId } = await uploadFn(buffer, row.id);
      await db.query(`UPDATE ${tabela} SET foto_url = $1, foto_public_id = $2 WHERE id = $3`, [url, publicId, row.id]);
      migrados++;
      console.log(`  [${label} #${row.id}] migrado -> ${url}`);
    } catch (err) {
      perdidos++;
      console.error(`  [${label} #${row.id}] FALHA no upload: ${err.message}`);
    }
  }

  return { migrados, perdidos, total: result.rows.length };
}

async function run() {
  console.log('Migrando fotos de associados...');
  const associados = await migrarTabela({
    label: 'associado',
    tabela: 'sindicato_associados',
    uploadDir: path.join(__dirname, '../uploads/associados'),
    uploadFn: fotoAssociadoService.uploadFotoAssociado,
  });

  console.log('\nMigrando fotos de dependentes...');
  const dependentes = await migrarTabela({
    label: 'dependente',
    tabela: 'sindicato_associados_dependentes',
    uploadDir: path.join(__dirname, '../uploads/dependentes'),
    uploadFn: fotoAssociadoService.uploadFotoDependente,
  });

  console.log('\n=== RESUMO ===');
  console.log(`Associados:  ${associados.migrados} migrados, ${associados.perdidos} perdidos, de ${associados.total} total`);
  console.log(`Dependentes: ${dependentes.migrados} migrados, ${dependentes.perdidos} perdidos, de ${dependentes.total} total`);
  process.exit(0);
}

run().catch(err => {
  console.error('Erro fatal na migração:', err);
  process.exit(1);
});

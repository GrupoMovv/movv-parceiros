// Importa contabilidades e empresas do Sindicato a partir do JSON exportado.
// Upsert idempotente por external_id — pode rodar quantas vezes for preciso.
// Execute: node scripts/import_sindicato.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const SEED_PATH = path.join(__dirname, 'scripts', 'data', 'sindicato_seed.json');
const SEM_CONTABILIDADE_EXTERNAL_ID = 'SEM';

async function upsertContabilidade(c) {
  const result = await db.query(
    `INSERT INTO sindicato_contabilidades
       (external_id, razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, estado, cep, telefone, celular, email, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (external_id) DO UPDATE SET
       razao_social  = EXCLUDED.razao_social,
       nome_fantasia = EXCLUDED.nome_fantasia,
       cnpj          = EXCLUDED.cnpj,
       endereco      = EXCLUDED.endereco,
       bairro        = EXCLUDED.bairro,
       cidade        = EXCLUDED.cidade,
       estado        = EXCLUDED.estado,
       cep           = EXCLUDED.cep,
       telefone      = EXCLUDED.telefone,
       celular       = EXCLUDED.celular,
       email         = EXCLUDED.email,
       status        = EXCLUDED.status,
       updated_at    = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      c.external_id, c.razao_social, c.nome_fantasia || null, c.cnpj || null,
      c.endereco || null, c.bairro || null, c.cidade || null, c.estado || null,
      c.cep || null, c.telefone || null, c.celular || null, c.email || null, c.status || null,
    ]
  );
  return result.rows[0];
}

async function upsertEmpresa(e, contabilidadeId) {
  const result = await db.query(
    `INSERT INTO sindicato_empresas
       (external_id, razao_social, nome_fantasia, cnpj, cnae, endereco, complemento, bairro, cidade, estado, cep, telefone, celular, email, status, porte, categoria, contabilidade_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (external_id) DO UPDATE SET
       razao_social     = EXCLUDED.razao_social,
       nome_fantasia    = EXCLUDED.nome_fantasia,
       cnpj             = EXCLUDED.cnpj,
       cnae             = EXCLUDED.cnae,
       endereco         = EXCLUDED.endereco,
       complemento      = EXCLUDED.complemento,
       bairro           = EXCLUDED.bairro,
       cidade           = EXCLUDED.cidade,
       estado           = EXCLUDED.estado,
       cep              = EXCLUDED.cep,
       telefone         = EXCLUDED.telefone,
       celular          = EXCLUDED.celular,
       email            = EXCLUDED.email,
       status           = EXCLUDED.status,
       porte            = EXCLUDED.porte,
       categoria        = EXCLUDED.categoria,
       contabilidade_id = EXCLUDED.contabilidade_id,
       updated_at       = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      e.external_id, e.razao_social, e.nome_fantasia || null, e.cnpj || null, e.cnae || null,
      e.endereco || null, e.complemento || null, e.bairro || null, e.cidade || null, e.estado || null,
      e.cep || null, e.telefone || null, e.celular || null, e.email || null, e.status || null,
      e.porte || null, e.categoria || null, contabilidadeId,
    ]
  );
  return result.rows[0];
}

async function run() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const { contabilidades, empresas } = JSON.parse(raw);

  console.log(`Lidas ${contabilidades.length} contabilidades e ${empresas.length} empresas de ${SEED_PATH}`);

  // ─── Contabilidades ────────────────────────────────────────────────────
  const externalIdToContabId = new Map();
  let contabInserted = 0, contabUpdated = 0;

  for (const c of contabilidades) {
    const row = await upsertContabilidade(c);
    externalIdToContabId.set(c.external_id, row.id);
    row.inserted ? contabInserted++ : contabUpdated++;
  }

  // Contabilidade "coringa" pra empresas órfãs (sem contab_external_id no JSON)
  const semContab = await upsertContabilidade({
    external_id: SEM_CONTABILIDADE_EXTERNAL_ID,
    razao_social: 'SEM CONTABILIDADE',
    nome_fantasia: 'SEM CONTABILIDADE',
    status: 'Ativo',
  });
  externalIdToContabId.set(SEM_CONTABILIDADE_EXTERNAL_ID, semContab.id);
  semContab.inserted ? contabInserted++ : contabUpdated++;

  // ─── Empresas ──────────────────────────────────────────────────────────
  let empInserted = 0, empUpdated = 0, empOrfas = 0;

  for (const e of empresas) {
    let contabilidadeId = null;
    if (e.contab_external_id && externalIdToContabId.has(e.contab_external_id)) {
      contabilidadeId = externalIdToContabId.get(e.contab_external_id);
    } else {
      contabilidadeId = semContab.id;
      empOrfas++;
    }
    const row = await upsertEmpresa(e, contabilidadeId);
    row.inserted ? empInserted++ : empUpdated++;
  }

  console.log('\n─── Resumo ───────────────────────────────');
  console.log(`Contabilidades: ${contabInserted} novas, ${contabUpdated} atualizadas (total ${contabilidades.length + 1} incl. SEM CONTABILIDADE)`);
  console.log(`Empresas:       ${empInserted} novas, ${empUpdated} atualizadas (total ${empresas.length})`);
  console.log(`Empresas órfãs vinculadas a SEM CONTABILIDADE: ${empOrfas}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Erro na importação:', err);
  process.exit(1);
});

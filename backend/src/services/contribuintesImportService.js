// Upsert idempotente da base de empresas contribuintes do Sindicato (guia
// mensal), usado tanto pelo script de linha de comando (scripts/import_empresas_pagantes.js)
// quanto pelo upload manual do admin (sindicatoContribuintesController).
//
// Status é sempre recalculado a partir de meses_pagos: 'atrasada' quando o
// autocadastro deve ficar bloqueado (dev IMPORTANTE: nunca seta 'inativa'
// aqui — esse status é reservado pra edição manual, não existe informação de
// inatividade no arquivo de pagamentos).
const db = require('../config/database');

function normalizarCnpj(v) {
  return String(v || '').replace(/\D/g, '');
}

function classificarStatus(mesesPagos) {
  return Number(mesesPagos) >= 3 ? 'adimplente' : 'atrasada';
}

// Retorna { inserted, statusChanged } — usado pra montar o resumo (X novas,
// Y atualizadas, Z status mudou) no preview de importação.
async function upsertContribuinte(row) {
  const cnpj = normalizarCnpj(row.cnpj);
  if (!cnpj) return null;

  const status = classificarStatus(row.meses_pagos);

  const anterior = await db.query(
    'SELECT status FROM sindicato_empresas_contribuintes WHERE cnpj = $1',
    [cnpj]
  );

  const result = await db.query(
    `INSERT INTO sindicato_empresas_contribuintes
       (cnpj, razao_social, nome_fantasia, endereco, complemento, bairro, cidade, estado, cep,
        telefone, celular, email, status, total_pago_periodo, meses_pagos, ultima_atualizacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     ON CONFLICT (cnpj) DO UPDATE SET
       razao_social       = EXCLUDED.razao_social,
       nome_fantasia      = EXCLUDED.nome_fantasia,
       endereco           = EXCLUDED.endereco,
       complemento        = EXCLUDED.complemento,
       bairro             = EXCLUDED.bairro,
       cidade             = EXCLUDED.cidade,
       estado             = EXCLUDED.estado,
       cep                = EXCLUDED.cep,
       telefone           = EXCLUDED.telefone,
       celular            = EXCLUDED.celular,
       email              = EXCLUDED.email,
       status             = EXCLUDED.status,
       total_pago_periodo = EXCLUDED.total_pago_periodo,
       meses_pagos        = EXCLUDED.meses_pagos,
       ultima_atualizacao = NOW(),
       updated_at         = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      cnpj, row.razao_social || null, row.nome_fantasia || null, row.endereco || null,
      row.complemento || null, row.bairro || null, row.cidade || null, row.estado || null,
      row.cep || null, row.telefone || null, row.celular || null, row.email || null,
      status, row.total_pago ?? row.total_pago_periodo ?? null, row.meses_pagos ?? null,
    ]
  );

  const inserted = result.rows[0].inserted;
  const statusChanged = !inserted && anterior.rows[0] && anterior.rows[0].status !== status;
  return { inserted, statusChanged, id: result.rows[0].id, cnpj, status };
}

async function importarLista(empresas) {
  let novas = 0, atualizadas = 0, statusMudou = 0;
  for (const row of empresas) {
    const r = await upsertContribuinte(row);
    if (!r) continue;
    if (r.inserted) novas++; else atualizadas++;
    if (r.statusChanged) statusMudou++;
  }
  return { novas, atualizadas, status_mudou: statusMudou, total_linhas: empresas.length };
}

module.exports = { normalizarCnpj, classificarStatus, upsertContribuinte, importarLista };

// Upsert idempotente da base de empresas contribuintes do Sindicato (guia
// mensal), usado tanto pelos scripts de linha de comando
// (scripts/import_empresas_pagantes.js, scripts/importar-recebimentos-sindicais.js)
// quanto pelo upload manual do admin (sindicatoContribuintesController).
//
// Status é sempre recalculado a partir de meses_pagos: empresa é
// "sindicalizada/ativa" (adimplente) se contribuiu em PELO MENOS 1 dos 3
// meses recentes — regra de negócio explícita (antes era >=3, ou seja,
// exigia os 3 meses pagos; mudou porque o financeiro confirmou que 1 de 3
// já conta como em dia). Isso muda o comportamento real do autocadastro:
// empresa que antes ficava "atrasada" com 1-2 meses pagos passa a poder
// se autocadastrar.
const db = require('../config/database');

function normalizarCnpj(v) {
  return String(v || '').replace(/\D/g, '');
}

function classificarStatus(mesesPagos) {
  return Number(mesesPagos) >= 1 ? 'adimplente' : 'atrasada';
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
        telefone, celular, email, status, total_pago_periodo, meses_pagos, ultimo_mes_pagamento,
        motivo_inativo, ultima_atualizacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL, NOW())
     ON CONFLICT (cnpj) DO UPDATE SET
       razao_social       = EXCLUDED.razao_social,
       nome_fantasia      = COALESCE(EXCLUDED.nome_fantasia, sindicato_empresas_contribuintes.nome_fantasia),
       endereco           = COALESCE(EXCLUDED.endereco, sindicato_empresas_contribuintes.endereco),
       complemento        = COALESCE(EXCLUDED.complemento, sindicato_empresas_contribuintes.complemento),
       bairro             = COALESCE(EXCLUDED.bairro, sindicato_empresas_contribuintes.bairro),
       cidade             = COALESCE(EXCLUDED.cidade, sindicato_empresas_contribuintes.cidade),
       estado             = COALESCE(EXCLUDED.estado, sindicato_empresas_contribuintes.estado),
       cep                = COALESCE(EXCLUDED.cep, sindicato_empresas_contribuintes.cep),
       telefone           = COALESCE(EXCLUDED.telefone, sindicato_empresas_contribuintes.telefone),
       celular            = COALESCE(EXCLUDED.celular, sindicato_empresas_contribuintes.celular),
       email              = COALESCE(EXCLUDED.email, sindicato_empresas_contribuintes.email),
       status             = EXCLUDED.status,
       total_pago_periodo = EXCLUDED.total_pago_periodo,
       meses_pagos        = EXCLUDED.meses_pagos,
       ultimo_mes_pagamento = COALESCE(EXCLUDED.ultimo_mes_pagamento, sindicato_empresas_contribuintes.ultimo_mes_pagamento),
       motivo_inativo     = NULL,
       ultima_atualizacao = NOW(),
       updated_at         = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      cnpj, row.razao_social || null, row.nome_fantasia || null, row.endereco || null,
      row.complemento || null, row.bairro || null, row.cidade || null, row.estado || null,
      row.cep || null, row.telefone || null, row.celular || null, row.email || null,
      status, row.total_pago ?? row.total_pago_periodo ?? null, row.meses_pagos ?? null,
      row.ultimo_mes_pagamento || null,
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

// Empresa que já estava cadastrada mas não apareceu na importação mais
// recente (não pagou nenhum dos 3 meses do arquivo novo) — nunca apaga,
// só marca inativa. Só desativa quem ainda não está inativo, pra não ficar
// reescrevendo a mesma linha (e o mesmo motivo) toda importação.
async function desativarAusentes(cnpjsPresentes) {
  const result = await db.query(
    `UPDATE sindicato_empresas_contribuintes
     SET status = 'inativa', motivo_inativo = 'Sem pagamento nos últimos 3 meses', updated_at = NOW()
     WHERE NOT (cnpj = ANY($1::text[])) AND status != 'inativa'
     RETURNING id`,
    [cnpjsPresentes]
  );
  return result.rows.length;
}

module.exports = { normalizarCnpj, classificarStatus, upsertContribuinte, importarLista, desativarAusentes };

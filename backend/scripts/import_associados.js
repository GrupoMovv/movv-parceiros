// Importa associados do Sindicato a partir da planilha exportada do Higestor.
// Upsert idempotente por external_id — pode rodar quantas vezes for preciso.
//
// Preserva edições manuais do Renan no portal: nunca sobrescreve o campo
// `whatsapp` num associado que já existe (só é preenchido, a partir do
// celular, na primeira importação do registro). Também não mexe em `ativo`,
// `observacoes`, `email` e `cadastrado_por_id`, que são geridos pelo portal.
//
// Execute: node scripts/import_associados.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const XLSX = require('xlsx');
const db = require('../src/config/database');

const XLSX_PATH = path.join(__dirname, 'data', 'associados.xlsx');
const HEADER_ROW_INDEX = 4; // linha 5 (0-indexed)
const FIRST_DATA_ROW_INDEX = HEADER_ROW_INDEX + 1;

const COL = {
  ID: 0, NOME: 1, CPF: 2, CIDADE: 3, ESTADO: 4, CELULAR: 5,
  NASCIMENTO: 6, SEXO: 7, CATEGORIA: 8, CODIGO_FILIADO: 9,
  DEP_INICIO: 10, DEP_FIM: 15, // Dependente 1..6
};

function lerLinhas() {
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // O !ref exportado pelo Higestor vem errado (só cobre a coluna A), então as
  // demais colunas (B..P) ficam fora do range declarado e o parser as ignora
  // se não corrigirmos o range antes de converter.
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (const cell of Object.keys(sheet)) {
    if (cell[0] === '!') continue;
    const dec = XLSX.utils.decode_cell(cell);
    if (dec.c > range.e.c) range.e.c = dec.c;
    if (dec.r > range.e.r) range.e.r = dec.r;
  }
  sheet['!ref'] = XLSX.utils.encode_range(range);

  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
}

function normalizaTexto(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizaDigitos(v) {
  const s = normalizaTexto(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  return digits ? digits : null;
}

function normalizaSexo(v) {
  const s = normalizaTexto(v);
  if (!s) return null;
  const up = s.toUpperCase();
  return ['F', 'M', 'P'].includes(up) ? up : null;
}

function normalizaData(v) {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
  const y = v.getUTCFullYear();
  const m = String(v.getUTCMonth() + 1).padStart(2, '0');
  const d = String(v.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extraiAssociado(row) {
  const externalId = normalizaTexto(row[COL.ID]);
  if (!externalId || !/^\d+$/.test(externalId)) return null; // rodapé / linha invalida

  const cpf = normalizaTexto(row[COL.CPF]);
  if (!cpf) return null;

  const celular = normalizaDigitos(row[COL.CELULAR]);
  const dependentes = [];
  for (let i = COL.DEP_INICIO; i <= COL.DEP_FIM; i++) {
    const nome = normalizaTexto(row[i]);
    if (nome) dependentes.push({ ordem: i - COL.DEP_INICIO + 1, nome });
  }

  return {
    external_id: externalId,
    nome_completo: normalizaTexto(row[COL.NOME]) || externalId,
    cpf,
    cidade: normalizaTexto(row[COL.CIDADE]),
    estado: normalizaTexto(row[COL.ESTADO]),
    celular,
    whatsapp_inicial: celular,
    data_nascimento: normalizaData(row[COL.NASCIMENTO]),
    sexo: normalizaSexo(row[COL.SEXO]),
    categoria_profissional: normalizaTexto(row[COL.CATEGORIA]),
    codigo_filiado: normalizaTexto(row[COL.CODIGO_FILIADO]),
    dependentes,
  };
}

async function upsertAssociado(a) {
  const result = await db.query(
    `INSERT INTO sindicato_associados
       (external_id, nome_completo, cpf, data_nascimento, sexo, categoria_profissional,
        codigo_filiado, celular, whatsapp, cidade, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (external_id) DO UPDATE SET
       nome_completo          = EXCLUDED.nome_completo,
       cpf                    = EXCLUDED.cpf,
       data_nascimento        = EXCLUDED.data_nascimento,
       sexo                   = EXCLUDED.sexo,
       categoria_profissional = EXCLUDED.categoria_profissional,
       codigo_filiado         = EXCLUDED.codigo_filiado,
       celular                = EXCLUDED.celular,
       cidade                 = EXCLUDED.cidade,
       estado                 = EXCLUDED.estado,
       updated_at             = NOW()
     RETURNING id, whatsapp, (xmax = 0) AS inserted`,
    [
      a.external_id, a.nome_completo, a.cpf, a.data_nascimento, a.sexo, a.categoria_profissional,
      a.codigo_filiado, a.celular, a.whatsapp_inicial, a.cidade, a.estado,
    ]
  );
  return result.rows[0];
}

async function upsertDependentes(associadoId, dependentes) {
  for (const dep of dependentes) {
    await db.query(
      `INSERT INTO sindicato_associados_dependentes (associado_id, nome, ordem)
       VALUES ($1, $2, $3)
       ON CONFLICT (associado_id, ordem) DO UPDATE SET nome = EXCLUDED.nome`,
      [associadoId, dep.nome, dep.ordem]
    );
  }
}

async function main() {
  const linhas = lerLinhas();
  const registros = linhas.slice(FIRST_DATA_ROW_INDEX).map(extraiAssociado).filter(Boolean);

  console.log(`Linhas válidas na planilha: ${registros.length}`);

  let inseridos = 0, atualizados = 0, erros = 0;
  let comWhatsapp = 0, semWhatsapp = 0, comDependentes = 0;

  for (const a of registros) {
    try {
      const { id, whatsapp, inserted } = await upsertAssociado(a);
      if (inserted) inseridos++; else atualizados++;
      if (whatsapp) comWhatsapp++; else semWhatsapp++;
      if (a.dependentes.length) comDependentes++;

      await upsertDependentes(id, a.dependentes);
    } catch (err) {
      erros++;
      console.error(`Erro no associado external_id=${a.external_id} (${a.nome_completo}): ${err.message}`);
    }
  }

  console.log('\n=== Importação concluída ===');
  console.log(`Total importado: ${inseridos + atualizados}`);
  console.log(`  Novos:      ${inseridos}`);
  console.log(`  Atualizados: ${atualizados}`);
  console.log(`  Erros:      ${erros}`);
  console.log(`Com WhatsApp: ${comWhatsapp}`);
  console.log(`Sem WhatsApp: ${semWhatsapp}`);
  console.log(`Com dependentes: ${comDependentes}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

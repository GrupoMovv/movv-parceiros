// Lê a planilha de empresas pagantes por NOME de coluna (não posição) — a
// exportação do financeiro do Sindicato muda de layout de vez em quando, e
// mapear por header tolera reordenação/colunas extras sem quebrar o import.
const XLSX = require('xlsx');

const ALIASES = {
  razao_social:  ['razaosocial', 'razão social', 'nome'],
  nome_fantasia: ['nomefantasia', 'fantasia'],
  cnpj:          ['cnpj'],
  endereco:      ['endereco', 'endereço', 'logradouro'],
  complemento:   ['complemento'],
  bairro:        ['bairro'],
  cidade:        ['cidade', 'municipio', 'município'],
  estado:        ['estado', 'uf'],
  cep:           ['cep'],
  telefone:      ['telefone', 'fone'],
  celular:       ['celular', 'whatsapp'],
  email:         ['email', 'e-mail'],
  total_pago:    ['totalpago', 'valorpago', 'totalarrecadado'],
  meses_pagos:   ['mesespagos', 'qtdmeses', 'quantidademeses'],
};

function normalizarChave(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function montarMapaColunas(headerRow) {
  const mapa = {}; // índice da coluna -> campo canônico
  headerRow.forEach((h, idx) => {
    const chaveNormalizada = normalizarChave(h);
    for (const [campo, aliases] of Object.entries(ALIASES)) {
      if (aliases.some(a => normalizarChave(a) === chaveNormalizada)) {
        mapa[idx] = campo;
        break;
      }
    }
  });
  return mapa;
}

function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (linhas.length < 2) return [];

  const mapaColunas = montarMapaColunas(linhas[0]);
  if (!Object.values(mapaColunas).includes('cnpj')) {
    throw new Error('Planilha sem coluna de CNPJ reconhecível');
  }

  const empresas = [];
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.every(c => c == null || c === '')) continue;

    const row = {};
    for (const [idx, campo] of Object.entries(mapaColunas)) {
      row[campo] = linha[Number(idx)];
    }
    if (!row.cnpj) continue;

    if (row.meses_pagos != null) row.meses_pagos = parseInt(row.meses_pagos, 10) || 0;
    if (row.total_pago != null) row.total_pago = parseFloat(String(row.total_pago).replace(',', '.')) || 0;
    for (const campo of ['razao_social', 'nome_fantasia', 'endereco', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'telefone', 'celular', 'email']) {
      if (row[campo] != null) row[campo] = String(row[campo]).trim();
    }

    empresas.push(row);
  }

  return empresas;
}

module.exports = { parseXlsxBuffer };

// Parser do "Relatório de Recebimentos" (export bruto do financeiro do
// Sindicato) — DIFERENTE do contribuintesXlsxParser.js: aqui cada linha é
// UM PAGAMENTO (não uma empresa já agregada), com um bloco de título/
// metadados no topo do arquivo antes do cabeçalho de verdade. O cabeçalho
// é achado por conteúdo (não por número de linha fixo), porque a posição
// varia um pouco entre exportações.
const XLSX = require('xlsx');

const ALIASES = {
  nome:        ['nomecompletorazaosocial', 'razaosocial', 'nome'],
  cpfCnpj:     ['cpfcnpj', 'cnpjcpf', 'cnpj'],
  referencia:  ['referencia'],
  exercicio:   ['exercicio'],
  valorPago:   ['valorpago'],
};

const MESES = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function normalizarChave(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function normalizarMes(s) {
  const chave = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim();
  return MESES[chave] || null;
}

function montarMapaColunas(headerRow) {
  const mapa = {};
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

function acharLinhaCabecalho(linhas) {
  // Procura nas primeiras ~20 linhas por uma que tenha CPF/CNPJ e
  // Referência juntos — é o cabeçalho de verdade, tudo antes é o bloco de
  // filtro/totais do relatório.
  for (let i = 0; i < Math.min(20, linhas.length); i++) {
    const mapa = montarMapaColunas(linhas[i] || []);
    const campos = Object.values(mapa);
    if (campos.includes('cpfCnpj') && campos.includes('referencia')) return i;
  }
  return -1;
}

// Descobre os "3 meses recentes" pela FREQUÊNCIA de linhas por mês — o
// arquivo é filtrado por data de crédito num período de ~3 meses, mas
// carrega uma cauda de pagamentos avulsos/atrasados de meses/anos bem mais
// antigos (referência de fatura vencida há tempo, creditada agora). Os 3
// meses com mais linhas são, na prática, os 3 meses que o arquivo
// realmente representa — e isso se ajusta sozinho a cada atualização
// mensal, sem precisar hardcodar mês/ano.
function acharTresMesesRecentes(pagamentos) {
  const contagem = new Map();
  for (const p of pagamentos) {
    if (!p.chaveMes) continue;
    contagem.set(p.chaveMes, (contagem.get(p.chaveMes) || 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([chave]) => chave);
}

/**
 * @returns {{ empresas: Array, tresMesesRecentes: string[], linhasIgnoradasCpf: number }}
 * empresas: [{ cnpj, razao_social, meses_pagos, ultimo_mes_pagamento, total_pago }]
 */
function parseRecebimentosBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const idxCabecalho = acharLinhaCabecalho(linhas);
  if (idxCabecalho === -1) {
    throw new Error('Não encontrei as colunas "CPF/CNPJ" e "Referência" na planilha — confira se é o Relatório de Recebimentos correto.');
  }
  const mapaColunas = montarMapaColunas(linhas[idxCabecalho]);

  const pagamentos = [];
  let linhasIgnoradasCpf = 0;

  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.every(c => c == null || c === '')) continue;

    const row = {};
    for (const [idx, campo] of Object.entries(mapaColunas)) {
      row[campo] = linha[Number(idx)];
    }
    if (!row.cpfCnpj) continue;

    const digitos = String(row.cpfCnpj).replace(/\D/g, '');
    if (digitos.length !== 14) { linhasIgnoradasCpf++; continue; } // só CNPJ — ignora CPF (11 dígitos)

    const mes = normalizarMes(row.referencia);
    const ano = parseInt(row.exercicio, 10);
    if (!mes || !ano) continue;

    pagamentos.push({
      cnpj: digitos,
      razao_social: String(row.nome || '').trim(),
      chaveMes: `${ano}-${String(mes).padStart(2, '0')}`,
      ano, mes,
      valorPago: parseFloat(row.valorPago) || 0,
    });
  }

  const tresMesesRecentes = acharTresMesesRecentes(pagamentos);
  const tresMesesSet = new Set(tresMesesRecentes);

  const porCnpj = new Map();
  for (const p of pagamentos) {
    if (!porCnpj.has(p.cnpj)) {
      porCnpj.set(p.cnpj, { cnpj: p.cnpj, razao_social: p.razao_social, mesesPagos: new Set(), ultimaChave: p.chaveMes, total_pago: 0 });
    }
    const acc = porCnpj.get(p.cnpj);
    if (tresMesesSet.has(p.chaveMes)) acc.mesesPagos.add(p.chaveMes);
    if (p.chaveMes > acc.ultimaChave) { acc.ultimaChave = p.chaveMes; acc.razao_social = p.razao_social; }
    acc.total_pago += p.valorPago;
  }

  const empresas = [...porCnpj.values()].map(acc => ({
    cnpj: acc.cnpj,
    razao_social: acc.razao_social,
    meses_pagos: acc.mesesPagos.size,
    ultimo_mes_pagamento: `${acc.ultimaChave}-01`,
    total_pago: Math.round(acc.total_pago * 100) / 100,
  }));

  return { empresas, tresMesesRecentes, linhasIgnoradasCpf };
}

module.exports = { parseRecebimentosBuffer, normalizarMes, MESES };

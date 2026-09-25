// Parser do "Relatório de Recebimentos" do Higestor pra Base SECI
// (/sindicato/base-seci). Aceita .xlsx, .xls e .csv. Cada linha é UM título
// pago — a mesma empresa aparece várias vezes quando paga mais de uma
// mensalidade/parcela, então agrupa por CPF/CNPJ e soma o Valor Pago.
//
// O topo do arquivo tem um bloco de filtro/totais antes do cabeçalho real:
//   "Filtro: Títulos quitados — Data de Crédito entre 01/08/2026 e 31/08/2026"
// Essa linha diz duas coisas: se o relatório é só de títulos quitados (aí
// toda linha conta como pagamento) e qual período de crédito ele cobre —
// o mês do arquivo é o fim desse período. A coluna "Referência" (competência
// do título, ex. JULHO pago em agosto) é ignorada de propósito: o que
// interessa pra "em dia" é QUANDO o dinheiro entrou.
const XLSX = require('xlsx');

const ALIASES = {
  nome:          ['nomecompletorazaosocial', 'razaosocial', 'nomecompleto', 'nome'],
  fantasia:      ['nomefantasia', 'fantasia'],
  documento:     ['cpfcnpj', 'cnpjcpf', 'cnpj', 'cpf', 'documento'],
  codigoFiliado: ['codigodofiliado', 'codigofiliado', 'codfiliado'],
  valorPago:     ['valorpago'],
  pagamento:     ['pagamento', 'datapagamento', 'datadopagamento'],
};

function normalizarTexto(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

// Planilha exportada com o documento como NÚMERO perde o zero à esquerda
// (06.123.456/0001-90 vira 6123456000190) — só nesse caso completa com zeros.
function normalizarDocumento(valor) {
  if (valor == null || valor === '') return null;
  let digitos;
  if (typeof valor === 'number') {
    digitos = String(Math.round(valor));
    if (digitos.length === 12 || digitos.length === 13) digitos = digitos.padStart(14, '0');
    else if (digitos.length === 9 || digitos.length === 10) digitos = digitos.padStart(11, '0');
  } else {
    digitos = String(valor).replace(/\D/g, '');
  }
  if (digitos.length === 11) return { digitos, tipo: 'cpf' };
  if (digitos.length === 14) return { digitos, tipo: 'cnpj' };
  return null;
}

function formatarDocumento(digitos) {
  const d = String(digitos || '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}

// Mantém a máscara que veio no arquivo; se veio só dígitos (ou número),
// formata pra exibição ficar legível.
function documentoExibicao(valorOriginal, digitos) {
  if (typeof valorOriginal === 'string' && /\D/.test(valorOriginal.trim())) return valorOriginal.trim();
  return formatarDocumento(digitos);
}

// "1.234,56" / "R$ 35,50" / 35.5 -> número
function parseValor(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function chaveMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

// 'YYYY-MM' menos n meses
function mesesAtras(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) - n;
  return chaveMes(Math.floor(total / 12), (total % 12) + 1);
}

// Serial do Excel (46244), "dd/mm/aaaa" ou Date -> 'YYYY-MM'
function mesDaData(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d && d.y > 1900 ? chaveMes(d.y, d.m) : null;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return chaveMes(v.getFullYear(), v.getMonth() + 1);
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? chaveMes(m[3], m[2]) : null;
}

// xlsx (zip "PK") e xls (OLE) vão direto pro SheetJS; o resto é tratado como
// CSV em texto — UTF-8 ou, se vier com caractere quebrado, Latin-1 (padrão
// do Excel brasileiro ao "salvar como CSV"). raw:true no CSV mantém tudo
// como texto, sem o SheetJS converter documento em número.
function lerLinhas(buffer) {
  const assinatura = buffer.subarray(0, 4).toString('hex');
  let wb;
  if (assinatura.startsWith('504b') || assinatura === 'd0cf11e0') {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } else {
    let texto = buffer.toString('utf8');
    if (texto.includes('\uFFFD')) texto = buffer.toString('latin1');
    wb = XLSX.read(texto.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
}

function montarMapaColunas(headerRow) {
  const mapa = {};
  const usados = new Set();
  (headerRow || []).forEach((h, idx) => {
    const chave = normalizarTexto(h);
    for (const [campo, aliases] of Object.entries(ALIASES)) {
      if (!usados.has(campo) && aliases.includes(chave)) {
        mapa[idx] = campo;
        usados.add(campo);
        break;
      }
    }
  });
  return mapa;
}

// A posição do cabeçalho muda entre exportações — acha por conteúdo.
function acharLinhaCabecalho(linhas) {
  for (let i = 0; i < Math.min(30, linhas.length); i++) {
    const campos = Object.values(montarMapaColunas(linhas[i]));
    if (campos.includes('documento') && (campos.includes('nome') || campos.includes('valorPago'))) return i;
  }
  return -1;
}

function lerFiltro(linhasTopo) {
  for (const linha of linhasTopo) {
    for (const celula of linha || []) {
      if (typeof celula !== 'string' || !normalizarTexto(celula).startsWith('filtro')) continue;
      const periodo = celula.match(/(\d{2})\/(\d{2})\/(\d{4})\s+e\s+(\d{2})\/(\d{2})\/(\d{4})/);
      return {
        texto: celula.trim(),
        quitados: normalizarTexto(celula).includes('quitad'),
        janela: periodo ? { inicio: chaveMes(periodo[3], periodo[2]), fim: chaveMes(periodo[6], periodo[5]) } : null,
      };
    }
  }
  return { texto: null, quitados: false, janela: null };
}

class MesObrigatorioError extends Error {
  constructor() {
    super('Não consegui descobrir o mês deste arquivo. Informe o mês de referência e envie de novo.');
    this.code = 'MES_OBRIGATORIO';
  }
}

/**
 * @param {Buffer} buffer
 * @param {{ mesInformado?: string }} opts  'YYYY-MM', só usado quando o arquivo não diz o mês
 */
function parseBaseSeci(buffer, { mesInformado } = {}) {
  const linhas = lerLinhas(buffer);
  const idxCabecalho = acharLinhaCabecalho(linhas);
  if (idxCabecalho === -1) {
    throw new Error('Não encontrei o cabeçalho (colunas "CPF/CNPJ" e "Nome Completo/Razão Social" ou "Valor Pago"). Confira se é o Relatório de Recebimentos do Higestor.');
  }
  const mapa = montarMapaColunas(linhas[idxCabecalho]);
  const temColunaValor = Object.values(mapa).includes('valorPago');
  const filtro = lerFiltro(linhas.slice(0, idxCabecalho));

  // 1ª passada: lê as linhas válidas
  const pagamentos = [];
  let linhasIgnoradas = 0;
  let linhasSemPagamento = 0;
  const exemplosIgnorados = [];

  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.every(c => c == null || c === '')) continue;

    const row = {};
    for (const [idx, campo] of Object.entries(mapa)) row[campo] = linha[Number(idx)];

    const doc = normalizarDocumento(row.documento);
    if (!doc) {
      linhasIgnoradas++;
      if (exemplosIgnorados.length < 5) exemplosIgnorados.push({ linha: i + 1, documento: row.documento ?? null, nome: row.nome ?? null });
      continue;
    }

    const valor = parseValor(row.valorPago);
    // Relatório de títulos quitados: toda linha é pagamento. Qualquer outro
    // (ex.: títulos em aberto) só conta quem tem Valor Pago de fato.
    if (!filtro.quitados && temColunaValor && valor <= 0) { linhasSemPagamento++; continue; }

    pagamentos.push({
      doc,
      original: row.documento,
      nome: row.nome != null ? String(row.nome).trim() : '',
      fantasia: row.fantasia != null ? String(row.fantasia).trim() : '',
      codigoFiliado: row.codigoFiliado != null ? String(row.codigoFiliado).trim() : '',
      mesPagamento: mesDaData(row.pagamento),
      valor,
    });
  }

  // Mês do arquivo: fim do período do filtro > mês informado > último mês de pagamento
  let mesReferencia = filtro.janela?.fim || null;
  let origemMes = 'filtro';
  if (!mesReferencia && mesInformado) { mesReferencia = mesInformado; origemMes = 'informado'; }
  if (!mesReferencia) {
    const meses = pagamentos.map(p => p.mesPagamento).filter(Boolean).sort();
    mesReferencia = meses[meses.length - 1] || null;
    origemMes = 'pagamentos';
  }
  if (!mesReferencia) throw new MesObrigatorioError();

  // Mês de cada pagamento, sempre dentro do período do arquivo: relatório de
  // 1 mês põe tudo nesse mês (pagou dia 31, creditou dia 1 = mês do arquivo).
  const inicio = filtro.janela?.inicio || (origemMes === 'informado' ? mesReferencia : null);
  for (const p of pagamentos) {
    let mes = p.mesPagamento || mesReferencia;
    if (mes > mesReferencia) mes = mesReferencia;
    if (inicio && mes < inicio) mes = inicio;
    p.mes = mes;
  }

  // 2ª passada: agrupa por documento
  const porDoc = new Map();
  const arrecadadoPorMes = {};
  for (const p of pagamentos) {
    arrecadadoPorMes[p.mes] = (arrecadadoPorMes[p.mes] || 0) + p.valor;

    let acc = porDoc.get(p.doc.digitos);
    if (!acc) {
      acc = { doc: p.doc, original: p.original, nome: '', fantasia: '', codigoFiliado: '', mes: p.mes, valorPorMes: {}, total: 0 };
      porDoc.set(p.doc.digitos, acc);
    }
    acc.valorPorMes[p.mes] = (acc.valorPorMes[p.mes] || 0) + p.valor;
    acc.total += p.valor;
    // nome/fantasia do pagamento mais recente (cadastro pode ter mudado)
    if (p.mes >= acc.mes) {
      acc.mes = p.mes;
      if (p.nome) acc.nome = p.nome;
      if (p.fantasia) acc.fantasia = p.fantasia;
    }
    if (!acc.nome && p.nome) acc.nome = p.nome;
    if (!acc.fantasia && p.fantasia) acc.fantasia = p.fantasia;
    if (!acc.codigoFiliado && p.codigoFiliado) acc.codigoFiliado = p.codigoFiliado;
  }

  const centavos = v => Math.round(v * 100) / 100;
  const empresas = [...porDoc.values()].map(acc => {
    const exibicao = documentoExibicao(acc.original, acc.doc.digitos);
    return {
      cnpj_cpf: acc.doc.digitos,
      tipo_documento: acc.doc.tipo,
      documento_exibicao: exibicao,
      razao_social: acc.nome || acc.fantasia || exibicao,
      nome_fantasia: acc.fantasia || null,
      codigo_filiado: acc.codigoFiliado || null,
      mes_referencia: acc.mes,
      ultimo_valor_pago: centavos(acc.valorPorMes[acc.mes] || 0),
      total_pago_arquivo: centavos(acc.total),
    };
  });

  for (const k of Object.keys(arrecadadoPorMes)) arrecadadoPorMes[k] = centavos(arrecadadoPorMes[k]);

  return {
    empresas,
    mesReferencia,
    origemMes,
    filtro: filtro.texto,
    janela: filtro.janela,
    titulosQuitados: filtro.quitados,
    arrecadadoPorMes,
    totalArrecadado: arrecadadoPorMes[mesReferencia] || 0,
    totalPagamentos: pagamentos.length,
    linhasIgnoradas,
    linhasSemPagamento,
    exemplosIgnorados,
  };
}

module.exports = { parseBaseSeci, normalizarDocumento, formatarDocumento, mesesAtras, MesObrigatorioError };

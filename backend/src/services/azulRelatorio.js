// Leitura do relatório "Comissões pagas" da Azul (livro de comissões do
// Partner, Etapa 2). Funções puras: arquivo -> linhas normalizadas. Nada de
// banco nem de log com CPF aqui.
//
// Formatos:
//   csv_domus — "Exportar CSV Domus": cp1252, separador ";", cabeçalho na 1ª
//               linha, ";" sobrando no fim. Decimais com PONTO nas linhas
//               normais (133.44) e VÍRGULA na linha de desconto (20,00).
//   xls_azul  — o ".xls" do relatório é uma tabela HTML em cp1252, com
//               valores no formato brasileiro (1.567,99). Fallback.
// Os totais do rodapé do relatório NUNCA são usados (no Excel vêm errados):
// quem quiser total soma as linhas.
const crypto = require('crypto');
const { paraCentavos, formatarCentavos, paraPct4, formatarPct4 } = require('./dinheiro');

const decodificar = buf => new TextDecoder('windows-1252').decode(buf).replace(/^﻿/, '');

// "133.44" | "20,00" | "1.567,99" | "7623.55" | "1.567" (milhar) -> "133.44"
// Regra: com vírgula, a vírgula é o decimal e os pontos são milhar; sem
// vírgula, ponto seguido de 1 ou 2 dígitos no fim é decimal, e ponto
// seguido de grupos de 3 dígitos é milhar.
function normalizarNumero(texto) {
  let s = String(texto ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*,\d+$|^\d+,\d+$/.test(s)) throw new Error(`número inválido: ${texto}`);
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`número inválido: ${texto}`);
  }
  return neg ? `-${s}` : s;
}

const dinheiroDe = t => { const n = normalizarNumero(t); return n === null ? null : formatarCentavos(paraCentavos(n)); };
const pctDe = t => { const n = normalizarNumero(t); return n === null ? null : formatarPct4(paraPct4(n)); };

// "22/04/2026" -> "2026-04-22"
function dataDe(texto) {
  const s = String(texto ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`data inválida: ${s}`);
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error(`data inválida: ${s}`);
  return iso;
}

// CPF só com dígitos; exportação que perdeu o zero à esquerda volta a ter 11
function cpfDe(texto) {
  const d = String(texto ?? '').replace(/\D/g, '');
  if (!d) return null;
  return d.length < 11 ? d.padStart(11, '0') : d;
}

const contratoDe = texto => {
  const s = String(texto ?? '').trim().replace(/\s/g, '');
  return s || null;
};

const textoDe = t => {
  const s = String(t ?? '').trim().replace(/\s+/g, ' ');
  return s || null;
};

// Tipo da linha: PAGA = comissão recebida; ESTORNADA com contrato = estorno;
// ESTORNADA sem contrato = desconto da agência (ex.: "Esteira de Digitação").
function tipoDe(situacao, contrato) {
  if (situacao === 'PAGA') return 'comissao';
  if (situacao === 'ESTORNADA') return contrato ? 'estorno' : 'desconto';
  throw new Error(`SITUACAO desconhecida: ${situacao || '(vazia)'}`);
}

// Chave da linha (idempotência entre arquivos que se sobrepõem):
// contrato + data do pagamento + valor + situação + ocorrência no arquivo
// (duas linhas idênticas no mesmo arquivo viram ocorrência 1 e 2).
function atribuirChaves(linhas) {
  const vistos = new Map();
  for (const l of linhas) {
    const base = ['azul', l.numero_contrato || '', l.dt_pagamento, paraCentavos(l.valor_comissao).toString(), l.situacao].join('|');
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    l.ocorrencia = n;
    l.chave_linha = crypto.createHash('sha256').update(`${base}|${n}`).digest('hex');
  }
  return linhas;
}

function montarLinha(numero, c) {
  const contrato = contratoDe(c.contrato);
  const situacao = String(c.situacao || '').trim().toUpperCase();
  const dtPagamento = dataDe(c.dt_pagamento);
  if (!dtPagamento) throw new Error('sem DT PAGAMENTO');
  const valor = dinheiroDe(c.valor_comissao);
  if (valor === null) throw new Error('sem VALOR COMISSAO');
  if (paraCentavos(valor) < 0n) throw new Error('VALOR COMISSAO negativo');
  return {
    linha_numero: numero,
    tipo: tipoDe(situacao, contrato),
    numero_contrato: contrato,
    cliente_nome: textoDe(c.nome),
    cliente_cpf: cpfDe(c.cpf),
    banco: textoDe(c.banco),
    produto: textoDe(c.produto),
    valor_emprestimo: dinheiroDe(c.valor_emprestimo),
    valor_comissao: valor,
    percentual_comissao: pctDe(c.percentual_comissao),
    dt_operacao: dataDe(c.dt_operacao),
    dt_emissao: dataDe(c.dt_emissao),
    dt_pagamento: dtPagamento,
    competencia: dtPagamento.slice(0, 7),
    situacao,
    origem_relatorio: textoDe(c.origem),
    observacao: textoDe(c.observacao),
    cod_agente: textoDe(c.cod_agente),
  };
}

// ─── CSV Domus ──────────────────────────────────────────────────────────────

const COLUNAS_CSV = {
  nome: 'NOME', cpf: 'CPF', dt_operacao: 'DT OPERACAO', dt_emissao: 'DT EMISSAO', contrato: 'NUMERO DO CONTRATO',
  banco: 'BANCO', produto: 'PRODUTO', valor_emprestimo: 'VALOR EMPRESTIMO', dt_pagamento: 'DT PAGAMENTO',
  valor_comissao: 'VALOR COMISSAO', percentual_comissao: 'PERCENTUAL COMISSAO', origem: 'ORIGEM',
  situacao: 'SITUACAO', observacao: 'OBSERVACAO', cod_agente: 'CODAGENTE',
};
const OBRIGATORIAS_CSV = ['NOME', 'CPF', 'NUMERO DO CONTRATO', 'PRODUTO', 'DT PAGAMENTO', 'VALOR COMISSAO', 'SITUACAO'];

// split por ";" respeitando aspas (o Domus não usa, mas não custa)
function dividirCsv(linha) {
  const out = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === ';' && !aspas) { out.push(atual); atual = ''; } else atual += ch;
  }
  out.push(atual);
  return out;
}

function lerCsvDomus(texto) {
  const linhasTexto = texto.split(/\r?\n/);
  const cab = dividirCsv(linhasTexto[0] || '').map(s => s.trim().toUpperCase());
  const faltam = OBRIGATORIAS_CSV.filter(c => !cab.includes(c));
  if (faltam.length) throw new Error(`O arquivo não parece o CSV Domus da Azul: faltam as colunas ${faltam.join(', ')}.`);
  const idx = Object.fromEntries(Object.entries(COLUNAS_CSV).map(([k, col]) => [k, cab.indexOf(col)]));

  const linhas = [];
  const erros = [];
  for (let i = 1; i < linhasTexto.length; i++) {
    const bruta = linhasTexto[i];
    if (!bruta.trim()) continue;
    const campos = dividirCsv(bruta);
    if (campos.every(c => !c.trim())) continue;
    const c = Object.fromEntries(Object.entries(idx).map(([k, j]) => [k, j >= 0 ? (campos[j] ?? '') : '']));
    try {
      linhas.push(montarLinha(i + 1, c));
    } catch (err) {
      erros.push({ linha_numero: i + 1, motivo: err.message });
    }
  }
  return { linhas, erros };
}

// ─── .xls da Azul (tabela HTML) ─────────────────────────────────────────────

const ENTIDADES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const limparHtml = s => s.replace(/<[^>]*>/g, ' ')
  .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, e => ENTIDADES[e])
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim();

function lerXlsAzul(texto) {
  const linhasHtml = [...texto.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  const celulasDe = tr => [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => limparHtml(m[1]));

  let cab = null;
  let codAgente = null;
  const linhas = [];
  const erros = [];
  linhasHtml.forEach((tr, i) => {
    const cel = celulasDe(tr);
    const numero = i + 1;
    if (!cab) {
      const up = cel.map(c => c.toUpperCase());
      if (up.includes('NOME') && up.includes('N.CTT') && up.includes('VLR INCEN.')) cab = up;
      return;
    }
    const agente = cel.length === 1 && cel[0].match(/^AGENTE:\s*(\d+)/i);
    if (agente) { codAgente = agente[1]; return; }

    if (cel.length === cab.length) {
      const c = Object.fromEntries(cab.map((h, j) => [h, cel[j]]));
      if (!c.NOME && !c['N.CTT']) return;
      try {
        linhas.push(montarLinha(numero, {
          nome: c.NOME, cpf: c.CPF, dt_emissao: c['DT EMISSAO'], dt_pagamento: c['DT PGTO'],
          contrato: c['N.CTT'], produto: c.CONVENIO, valor_emprestimo: c['VLR EMPR.'],
          percentual_comissao: c['%'], valor_comissao: c['VLR INCEN.'], situacao: 'PAGA', cod_agente: codAgente,
        }));
      } catch (err) {
        erros.push({ linha_numero: numero, motivo: err.message });
      }
      return;
    }

    // desconto: [data] [descrição] [Vlr: 20,00 -]
    const vlr = cel.length >= 3 && cel[cel.length - 1].match(/^Vlr:\s*([\d.,]+)\s*([-+])?$/i);
    if (vlr) {
      if (vlr[2] === '+') { erros.push({ linha_numero: numero, motivo: 'acréscimo (+) no relatório: não suportado' }); return; }
      try {
        linhas.push(montarLinha(numero, {
          dt_pagamento: cel[0], valor_comissao: vlr[1], situacao: 'ESTORNADA',
          observacao: cel.slice(1, -1).join(' '), cod_agente: codAgente,
        }));
      } catch (err) {
        erros.push({ linha_numero: numero, motivo: err.message });
      }
    }
    // o resto (rodapé "Saldo de Comissao", "QTDADE", separadores) é ignorado de propósito
  });
  if (!cab) throw new Error('O arquivo não parece o relatório da Azul: não achei o cabeçalho (NOME, N.CTT, VLR INCEN.).');
  return { linhas, erros };
}

// ─── Entrada única ──────────────────────────────────────────────────────────

function lerRelatorioAzul(buffer) {
  const texto = decodificar(buffer);
  const html = /<table\b/i.test(texto.slice(0, 5000));
  const { linhas, erros } = html ? lerXlsAzul(texto) : lerCsvDomus(texto);
  atribuirChaves(linhas);
  return {
    formato: html ? 'xls_azul' : 'csv_domus',
    arquivo_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    linhas,
    erros,
  };
}

module.exports = { lerRelatorioAzul, normalizarNumero, dataDe, cpfDe };

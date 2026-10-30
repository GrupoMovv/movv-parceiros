const XLSX = require('xlsx');

// Linhas da 1ª aba de uma planilha enviada (Base SECI, lista aprovada).
// xlsx (zip "PK") e xls (OLE) vão direto pro SheetJS; o resto é tratado como
// CSV em texto — UTF-8 (com ou sem BOM) ou, se vier com caractere quebrado,
// Latin-1 (padrão do Excel brasileiro ao "salvar como CSV"). raw:true no CSV
// mantém tudo como texto, sem o SheetJS converter documento em número.
// Antes a lista aprovada lia o CSV direto do buffer e um UTF-8 sem BOM perdia
// os acentos ("Razão" virava "RazÃ£o") — 30/10/2026.
function lerLinhasPlanilha(buffer) {
  const assinatura = buffer.subarray(0, 4).toString('hex');
  let wb;
  if (assinatura.startsWith('504b') || assinatura === 'd0cf11e0') {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } else {
    let texto = buffer.toString('utf8');
    if (texto.includes('�')) texto = buffer.toString('latin1');
    wb = XLSX.read(texto.replace(/^﻿/, ''), { type: 'string', raw: true });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
}

module.exports = { lerLinhasPlanilha };

// Leitura do que /public/planos/precos devolve. Fica fora das telas porque
// tanto o painel do parceiro (Planos.jsx) quanto a pública /vender
// (Vender.jsx) precisam da mesma conta — e errar o desempacotamento é fácil.
//
// O endpoint devolve `preco_mensal` = preço da situação que o backend
// DETECTOU pelo CNPJ, e `preco_alternativo` = o outro. Qual dos dois é o de
// sindicalizada depende de `e_sindicalizada`, NUNCA da ordem dos campos:
// pra quem já é sindicalizada, o mais barato é o `preco_mensal`.
export function precosDoPlano(precoInfo, eSindicalizada) {
  if (!precoInfo) return null;
  const sind = eSindicalizada ? precoInfo.preco_mensal : precoInfo.preco_alternativo;
  const normal = eSindicalizada ? precoInfo.preco_alternativo : precoInfo.preco_mensal;
  return {
    sind,
    normal,
    sindFmt: eSindicalizada ? precoInfo.preco_mensal_formatado : precoInfo.preco_alternativo_formatado,
    normalFmt: eSindicalizada ? precoInfo.preco_alternativo_formatado : precoInfo.preco_mensal_formatado,
    // % real de desconto DESTE plano. Não é fixo: Oficial 69,90→34,90 dá 50%,
    // mas Premium dá 38% e Master 23% — número chapado mentiria em dois deles.
    offPct: normal > 0 ? Math.round(((normal - sind) / normal) * 100) : 0,
  };
}

// Em CENTAVOS: 69.90 - 34.90 dá 35.00000000000001 em float, e esse resto
// vaza pra qualquer conta feita em cima (ex.: x12 pro ano).
export function economiaMensal({ normal, sind }) {
  return (Math.round(normal * 100) - Math.round(sind * 100)) / 100;
}

// Maior desconto entre os planos pagos — é o número do "até X% OFF".
// `planos` é o objeto `planos` da resposta do endpoint.
export function descontoMaxPct(planos, eSindicalizada) {
  const pcts = Object.entries(planos || {})
    .filter(([chave]) => chave !== 'gratis')
    .map(([, info]) => precosDoPlano(info, eSindicalizada)?.offPct || 0);
  return pcts.length ? Math.max(...pcts) : 0;
}

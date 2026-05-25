const NET_FACTOR = 0.80; // 80% do faturamento bruto = lucro líquido base

// Curva Pabline — sobre lucro líquido (faturamento * 0.80)
function calcPablinePct(netRevenue) {
  if (netRevenue <= 50000)  return 0.05;
  if (netRevenue <= 100000) return 0.07;
  if (netRevenue <= 200000) return 0.06;
  if (netRevenue <= 300000) return 0.05;
  return 0.04;
}

// Curva Fernando Azul — sobre lucro líquido
function calcFernandoAzulPct(netRevenue) {
  if (netRevenue <= 50000)  return 0.005;
  if (netRevenue <= 100000) return 0.010;
  return 0.015;
}

// Calcula comissão completa de Pabline para um mês
function calcPabline({ azulRevenue }) {
  const net = parseFloat(azulRevenue) * NET_FACTOR;
  const pct = calcPablinePct(net);
  const azulCommission = parseFloat((net * pct).toFixed(2));
  const baseSalary = 1621.00;
  const totalAmount = parseFloat((azulCommission + baseSalary).toFixed(2));

  return {
    azul_commission_pct:       pct,
    azul_commission:           azulCommission,
    azul_normal_revenue:       0,
    azul_normal_commission:    0,
    seguros_total_revenue:     0,
    seguros_commission:        0,
    consorcios_revenue:        0,
    consorcios_commission:     0,
    direta_certificates_count: 0,
    direta_via_accounting:     0,
    direta_via_direct:         0,
    direta_commission:         0,
    base_salary:               baseSalary,
    total_amount:              totalAmount,
  };
}

// Calcula comissão completa de Fernando para um mês
// azulNormalRevenue  = Azul produtos normais (consignado, FGTS etc.) — curva 0.5/1/1.5% sobre LL
// segurosData        = array de { valorOperado, pctComissaoAzul } — Fernando recebe 20% do que Azul paga à Movv
// consorciosRevenue  = Azul Consórcios — Fernando recebe 1.5% sobre LL (80%)
// baseViaAccounting  = base de cálculo certs via contabilidade (25%)
// baseViaDirect      = base de cálculo certs venda direta (25%)
function calcFernando({
  azulRevenue       = 0,  // legacy compat — usado se azulNormalRevenue não fornecido
  azulNormalRevenue,
  segurosData       = [],
  consorciosRevenue = 0,
  baseViaAccounting = 0,
  baseViaDirect     = 0,
  certCount         = 0,
}) {
  // Azul Normal
  const normalRev  = parseFloat(azulNormalRevenue ?? azulRevenue ?? 0);
  const netNormal  = normalRev * NET_FACTOR;
  const azulPct    = calcFernandoAzulPct(netNormal);
  const azulNormalCommission = parseFloat((netNormal * azulPct).toFixed(2));

  // Seguros: Fernando = (valorOperado × %ComissaoAzul) × 20%
  const segurosArr       = Array.isArray(segurosData) ? segurosData : [];
  const segurosMovvTotal = segurosArr.reduce((sum, s) => {
    return sum + parseFloat(s.valorOperado || 0) * (parseFloat(s.pctComissaoAzul || 0) / 100);
  }, 0);
  const segurosCommission = parseFloat((segurosMovvTotal * 0.20).toFixed(2));

  // Consórcios: Fernando = valorOperado × 80% × 1.5%
  const consorciosRev        = parseFloat(consorciosRevenue || 0);
  const consorciosCommission = parseFloat((consorciosRev * NET_FACTOR * 0.015).toFixed(2));

  // Total Azul = soma dos 3 tipos
  const azulCommission = parseFloat((azulNormalCommission + segurosCommission + consorciosCommission).toFixed(2));

  // Direta
  const diretaViaAccounting = parseFloat((parseFloat(baseViaAccounting) * 0.25).toFixed(2));
  const diretaViaDirect     = parseFloat((parseFloat(baseViaDirect)     * 0.25).toFixed(2));
  const diretaCommission    = parseFloat((diretaViaAccounting + diretaViaDirect).toFixed(2));

  const totalCommission = azulCommission + diretaCommission;
  const baseSalary      = totalCommission >= 3500 ? 0 : 1621.00;
  const totalAmount     = parseFloat((totalCommission + baseSalary).toFixed(2));

  return {
    azul_commission_pct:       azulPct,
    azul_normal_revenue:       normalRev,
    azul_normal_commission:    azulNormalCommission,
    seguros_total_revenue:     parseFloat(segurosMovvTotal.toFixed(2)),
    seguros_commission:        segurosCommission,
    consorcios_revenue:        consorciosRev,
    consorcios_commission:     consorciosCommission,
    azul_commission:           azulCommission,
    direta_certificates_count: parseInt(certCount) || 0,
    direta_via_accounting:     diretaViaAccounting,
    direta_via_direct:         diretaViaDirect,
    direta_commission:         diretaCommission,
    base_salary:               baseSalary,
    total_amount:              totalAmount,
  };
}

// Curva completa para exibição no frontend
const CURVA_PABLINE = [
  { label: 'Até R$ 50.000',           min: 0,      max: 50000,   pct: 0.05 },
  { label: 'R$ 50.001 – R$ 100.000',  min: 50001,  max: 100000,  pct: 0.07 },
  { label: 'R$ 100.001 – R$ 200.000', min: 100001, max: 200000,  pct: 0.06 },
  { label: 'R$ 200.001 – R$ 300.000', min: 200001, max: 300000,  pct: 0.05 },
  { label: 'Acima de R$ 300.000',     min: 300001, max: Infinity, pct: 0.04 },
];

const CURVA_FERNANDO_AZUL = [
  { label: 'Até R$ 50.000',           min: 0,     max: 50000,   pct: 0.005 },
  { label: 'R$ 50.001 – R$ 100.000',  min: 50001, max: 100000,  pct: 0.010 },
  { label: 'Acima de R$ 100.000',     min: 100001,max: Infinity, pct: 0.015 },
];

module.exports = {
  calcPabline,
  calcFernando,
  calcPablinePct,
  calcFernandoAzulPct,
  CURVA_PABLINE,
  CURVA_FERNANDO_AZUL,
  NET_FACTOR,
};

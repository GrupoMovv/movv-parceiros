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
    azul_commission_pct:   pct,
    azul_commission:       azulCommission,
    direta_certificates_count: 0,
    direta_via_accounting: 0,
    direta_via_direct:     0,
    direta_commission:     0,
    base_salary:           baseSalary,
    total_amount:          totalAmount,
  };
}

// Calcula comissão completa de Fernando para um mês
// baseViaAccounting = (venda - custo - comissão cont.) para certificados via contabilidade
// baseViaDirect     = (venda - custo) para certificados venda direta
function calcFernando({ azulRevenue, baseViaAccounting = 0, baseViaDirect = 0, certCount = 0 }) {
  const net = parseFloat(azulRevenue) * NET_FACTOR;
  const pct = calcFernandoAzulPct(net);
  const azulCommission = parseFloat((net * pct).toFixed(2));

  const diretaViaAccounting = parseFloat((parseFloat(baseViaAccounting) * 0.25).toFixed(2));
  const diretaViaDirect     = parseFloat((parseFloat(baseViaDirect)     * 0.25).toFixed(2));
  const diretaCommission    = parseFloat((diretaViaAccounting + diretaViaDirect).toFixed(2));

  const totalCommission = azulCommission + diretaCommission;
  const baseSalary      = totalCommission >= 3500 ? 0 : 1621.00;
  const totalAmount     = parseFloat((totalCommission + baseSalary).toFixed(2));

  return {
    azul_commission_pct:       pct,
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

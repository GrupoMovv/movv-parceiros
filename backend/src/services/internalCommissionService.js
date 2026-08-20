// Calcula comissão completa de Pabline para um mês.
// azulTotal = comissão Azul total já paga à Movv no mês (valor bruto, digitado pelo admin).
// Pabline recebe 10% fixo desse valor (sem curva, sem fator de líquido).
function calcPabline({ azulTotal }) {
  const total          = parseFloat(azulTotal) || 0;
  const pct             = 0.10;
  const azulCommission  = parseFloat((total * pct).toFixed(2));
  const baseSalary      = 1621.00;
  const totalAmount     = parseFloat((azulCommission + baseSalary).toFixed(2));

  return {
    azul_commission_pct:       pct,
    azul_commission:           azulCommission,
    azul_revenue:              total,
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

module.exports = {
  calcPabline,
};

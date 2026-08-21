const SALARIO_FIXO_RENAN = 1000.00;

// Faixas de bônus por faturamento bruto mensal do Sindicato.
// minimo é inclusivo, maximo é exclusivo. Abaixo de 130.000: bônus zero.
const FAIXAS_BONUS_RENAN = [
  { minimo: 130000, maximo: 140000, bonus: 300 },
  { minimo: 140000, maximo: 150000, bonus: 400 },
  { minimo: 150000, maximo: 160000, bonus: 500 },
  { minimo: 160000, maximo: Infinity, bonus: 600 },
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calcularBonus(faturamentoBruto) {
  const f = parseFloat(faturamentoBruto);
  if (isNaN(f) || f < FAIXAS_BONUS_RENAN[0].minimo) return 0;

  const faixa = FAIXAS_BONUS_RENAN.find(fx => f >= fx.minimo && f < fx.maximo);
  return faixa ? faixa.bonus : 0;
}

function calcularFolha(faturamentoBruto) {
  const f = round2(parseFloat(faturamentoBruto) || 0);
  const bonus = calcularBonus(f);
  return {
    faturamento_bruto: f,
    bonus_renan: bonus,
    salario_fixo: SALARIO_FIXO_RENAN,
    total_mensal: round2(SALARIO_FIXO_RENAN + bonus),
  };
}

module.exports = {
  SALARIO_FIXO_RENAN,
  FAIXAS_BONUS_RENAN,
  calcularBonus,
  calcularFolha,
};

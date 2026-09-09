// Helpers de exibição de preço de plano — separado de config/planos.js
// porque aquele arquivo é dado puro (a "fonte de verdade"), e isso aqui é
// só formatação em cima do dado.

function calcularValorDiario(precoMensal) {
  return precoMensal / 30;
}

function formatarValorDiario(precoMensal) {
  return calcularValorDiario(precoMensal).toFixed(2).replace('.', ',');
}

function formatarPrecoBRL(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

module.exports = { calcularValorDiario, formatarValorDiario, formatarPrecoBRL };

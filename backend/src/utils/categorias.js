// Comparação de categoria sem acento/maiúscula — mesmo critério do front
// (parceirosData.js normalizarCategoria). categorias[] do parceiro é texto
// livre vindo de várias telas, então "Alimentação"/"alimentacao" precisam
// casar.
function normalizarCategoria(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// IUB Food = parceiro com "Alimentação" no categorias[] (não é
// tipo_negocio próprio — ver getFood em marketplaceHomeController.js).
function ehRestaurante(categorias) {
  const alvo = normalizarCategoria('Alimentação');
  return (categorias || []).some(c => normalizarCategoria(c) === alvo);
}

module.exports = { normalizarCategoria, ehRestaurante };

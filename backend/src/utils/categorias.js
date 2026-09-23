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

// IUB BEER = parceiro com "Bebidas" no categorias[] — mesmo critério do
// Food (ver beerController.js). Um bar pode ter as duas e aparecer nos dois.
function ehBebidas(categorias) {
  const alvo = normalizarCategoria('Bebidas');
  return (categorias || []).some(c => normalizarCategoria(c) === alvo);
}

module.exports = { normalizarCategoria, ehRestaurante, ehBebidas };

const { consultarDocumento } = require('./baseSeciService');

// Fonte única de verdade pra saber se um CNPJ é de empresa sindicalizada
// (em dia com o SECI na Base SECI, empresas_seci) — usado pro preço de
// plano do parceiro (publicPlanosController, sindicatoPlanosController,
// assinaturaService, parceiroSolicitacaoController). O autocadastro de
// associado consulta a mesma base via baseSeciService.
async function verificarSindicalizacao(cnpj) {
  const row = await consultarDocumento(String(cnpj || '').replace(/\D/g, ''));
  return {
    encontrada: Boolean(row),
    sindicalizada: Boolean(row) && row.em_dia,
    razaoSocial: row?.razao_social || null,
  };
}

module.exports = { verificarSindicalizacao };

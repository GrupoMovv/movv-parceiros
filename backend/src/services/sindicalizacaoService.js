const db = require('../config/database');

// Fonte única de verdade pra saber se um CNPJ é de empresa sindicalizada
// (em dia com o SECI) — usado tanto pro desconto de plano do parceiro
// (publicPlanosController, sindicatoPlanosController) quanto já era usado
// pelo autocadastro de associado (ver parceiroSolicitacaoController e
// publicCadastroController, que consultam a mesma tabela direto).
async function verificarSindicalizacao(cnpj) {
  const result = await db.query(
    'SELECT razao_social, status FROM sindicato_empresas_contribuintes WHERE cnpj = $1',
    [cnpj]
  );
  const row = result.rows[0];
  return {
    encontrada: Boolean(row),
    sindicalizada: Boolean(row) && row.status === 'adimplente',
    razaoSocial: row?.razao_social || null,
  };
}

module.exports = { verificarSindicalizacao };

const db = require('../config/database');
const { onlyDigits } = require('../utils/validators');

// Mostra só os 3 primeiros e os 2 últimos dígitos — o acesso já é protegido
// por token/sessão, isso aqui é só pra pessoa confirmar que é o cadastro
// dela, não pra reexibir o CPF completo numa página pública.
function maskCpfParcial(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

// View compartilhada entre /public/meu-cadastro/:edit_token (link antigo,
// mantido por retrocompatibilidade) e /public/painel/me (sessão por
// CPF + data de nascimento).
async function montarViewAssociado(associado) {
  const empresaResult = associado.empresa_id
    ? await db.query('SELECT nome_fantasia, razao_social FROM sindicato_empresas WHERE id = $1', [associado.empresa_id])
    : null;
  const empresaNome = empresaResult?.rows[0]
    ? (empresaResult.rows[0].nome_fantasia || empresaResult.rows[0].razao_social)
    : associado.empresa_nome_livre;

  const depResult = await db.query(
    `SELECT id, nome, grau, data_nascimento, foto_url, carteirinha_hash
     FROM sindicato_associados_dependentes WHERE associado_id = $1 ORDER BY ordem ASC`,
    [associado.id]
  );

  return {
    nome_completo: associado.nome_completo,
    cpf_parcial: maskCpfParcial(associado.cpf),
    whatsapp: associado.whatsapp,
    email: associado.email,
    foto_url: associado.foto_url,
    categoria_profissional: associado.categoria_profissional,
    cidade: associado.cidade,
    estado: associado.estado,
    empresa: empresaNome,
    carteirinha_hash: associado.carteirinha_hash,
    ativo: associado.ativo,
    dependentes: depResult.rows,
  };
}

module.exports = { maskCpfParcial, montarViewAssociado };

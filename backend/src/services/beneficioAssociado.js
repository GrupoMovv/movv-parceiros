const db = require('../config/database');

// Fonte única de "essa conta tem benefício de associado SECI AGORA?" —
// calculado a cada acesso, nada é desligado por rotina:
//   cliente    conta de consumidor comum
//   inativo    associado desativado pelo Sindicato
//   ativo      legado (antigos, sem validade — decisão do Junior), ou
//              carteirinha dentro da validade com a empresa vinculada em dia
//   pausado    carteirinha válida, mas a empresa vinculada está devendo —
//              volta sozinho quando ela regularizar na Base SECI
//   expirado   carteirinha venceu (6 meses): renova informando o CNPJ no /meu
// Data de hoje no fuso de Itumbiara (o servidor roda em UTC no Render).
const HOJE_SP = "(NOW() AT TIME ZONE 'America/Sao_Paulo')::date";

// Espera a tabela sindicato_associados como `a` e LEFT JOIN empresas_seci `es`.
const SITUACAO_SQL = `CASE
  WHEN a.tipo_acesso <> 'seci' THEN 'cliente'
  WHEN NOT a.ativo THEN 'inativo'
  WHEN a.legado THEN 'ativo'
  WHEN a.carteirinha_valida_ate IS NULL OR a.carteirinha_valida_ate < ${HOJE_SP} THEN 'expirado'
  WHEN es.id IS NOT NULL AND NOT es.em_dia THEN 'pausado'
  ELSE 'ativo'
END`;

const JOIN_EMPRESA_SQL = 'LEFT JOIN empresas_seci es ON es.id = a.empresa_seci_id';

async function situacaoDoAssociado(associadoId) {
  const r = await db.query(
    `SELECT ${SITUACAO_SQL} AS situacao, a.legado, a.carteirinha_valida_ate,
            es.razao_social AS empresa_razao, es.nome_fantasia AS empresa_fantasia, es.em_dia AS empresa_em_dia,
            es.tipo_documento AS empresa_tipo
     FROM sindicato_associados a ${JOIN_EMPRESA_SQL}
     WHERE a.id = $1`,
    [associadoId]
  );
  const s = r.rows[0];
  if (!s) return null;
  return {
    situacao: s.situacao,
    legado: s.legado,
    valida_ate: s.carteirinha_valida_ate,
    // Filiado pessoa física (vínculo pelo próprio CPF) não expõe "empresa".
    empresa: s.empresa_razao && s.empresa_tipo === 'cnpj'
      ? { nome: s.empresa_fantasia || s.empresa_razao, em_dia: s.empresa_em_dia }
      : null,
    filiado_pessoa_fisica: s.empresa_tipo === 'cpf',
  };
}

// Associado com benefício ativo pelo hash da carteirinha (links públicos
// ?associado=hash). null = trata como visitante.
async function associadoAtivoPorHash(hash, colunas = 'a.nome_completo, a.carteirinha_hash') {
  if (!hash) return null;
  const r = await db.query(
    `SELECT ${colunas}, a.tipo_acesso
     FROM sindicato_associados a ${JOIN_EMPRESA_SQL}
     WHERE a.carteirinha_hash = $1 AND ${SITUACAO_SQL} = 'ativo'`,
    [hash]
  );
  return r.rows[0] || null;
}

module.exports = { SITUACAO_SQL, JOIN_EMPRESA_SQL, HOJE_SP, situacaoDoAssociado, associadoAtivoPorHash };

// Registro de quem fez cada ação de dinheiro no portal (tabela admin_acoes,
// migration 088): aprovar, cancelar e voltar comissão, e marcar pagamento.
// Grava uma linha por registro afetado, na mesma transação da ação quando
// houver uma (passe o client); sem client usa o pool.
const db = require('../config/database');

function nomeDoAdmin(user) {
  if (!user) return 'desconhecido';
  return user.code ? `${user.name} (${user.code})` : (user.name || user.email || 'admin');
}

async function registrarAcao(cx, req, acao, alvoTipo, ids, detalhes = null) {
  const lista = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  if (!lista.length) return;
  await (cx || db).query(
    `INSERT INTO admin_acoes (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhes)
     SELECT $1, $2, $3, $4, x, $6 FROM unnest($5::int[]) AS x`,
    [req.user?.id || null, nomeDoAdmin(req.user), acao, alvoTipo, lista, detalhes ? JSON.stringify(detalhes) : null]
  );
}

// Trecho de SQL com a última ação de cada linha: colunas ultima_acao,
// ultima_acao_por e ultima_acao_em. `alias` é o apelido da tabela na query.
function joinUltimaAcao(alias, alvoTipo, apelido = 'ult') {
  return `LEFT JOIN LATERAL (
      SELECT a.acao, a.admin_nome, a.criado_em FROM admin_acoes a
      WHERE a.alvo_tipo = '${alvoTipo}' AND a.alvo_id = ${alias}.id
      ORDER BY a.criado_em DESC, a.id DESC LIMIT 1
    ) ${apelido} ON true`;
}
const COLUNAS_ULTIMA_ACAO = (apelido = 'ult') =>
  `${apelido}.acao AS ultima_acao, ${apelido}.admin_nome AS ultima_acao_por, ${apelido}.criado_em AS ultima_acao_em`;

module.exports = { registrarAcao, joinUltimaAcao, COLUNAS_ULTIMA_ACAO, nomeDoAdmin };

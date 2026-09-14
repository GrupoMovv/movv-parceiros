const db = require('../config/database');
const { anonimizarNome } = require('../utils/anonimizarNome');

// Filtros de periodo pro ranking — chave vem de req.query.periodo, sempre
// validada contra este whitelist antes de entrar na query (nunca
// interpolar o query param direto).
const FILTROS_PERIODO = {
  dia:    'm.data_partida::date = NOW()::date',
  semana: "date_trunc('week', m.data_partida) = date_trunc('week', NOW())",
};

// Registra o resultado de uma partida completa (todas as 8 duplas
// encontradas). Sem POST intermediário por jogada — o jogo inteiro roda
// no cliente, só o resultado final é gravado.
async function registrarPartida(req, res) {
  try {
    const associadoId = req.painelAssociado.id;
    const tempo = Number(req.body.tempo_segundos);
    const jogadas = Number(req.body.jogadas);

    // 8 duplas = no mínimo 8 jogadas (acertar todas de primeira); teto
    // generoso só pra barrar payload absurdo, não pra "validar" o jogo.
    if (!Number.isInteger(tempo) || tempo <= 0 || tempo > 3600) {
      return res.status(400).json({ error: 'tempo_segundos inválido' });
    }
    if (!Number.isInteger(jogadas) || jogadas < 8 || jogadas > 500) {
      return res.status(400).json({ error: 'jogadas inválido' });
    }

    const recordeAnterior = await db.query(
      'SELECT MIN(tempo_segundos)::int AS melhor FROM sindicato_memoria_partidas WHERE associado_id = $1',
      [associadoId]
    );
    const melhorAnterior = recordeAnterior.rows[0].melhor;
    const novoRecorde = melhorAnterior === null || tempo < melhorAnterior;

    const result = await db.query(
      `INSERT INTO sindicato_memoria_partidas (associado_id, tempo_segundos, jogadas)
       VALUES ($1, $2, $3) RETURNING *`,
      [associadoId, tempo, jogadas]
    );

    return res.status(201).json({
      partida: result.rows[0],
      novo_recorde: novoRecorde,
      melhor_tempo_pessoal: novoRecorde ? tempo : melhorAnterior,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar partida' });
  }
}

async function getMeuRecorde(req, res) {
  try {
    const result = await db.query(
      `SELECT MIN(tempo_segundos)::int AS melhor_tempo_segundos, COUNT(*)::int AS partidas_jogadas
       FROM sindicato_memoria_partidas WHERE associado_id = $1`,
      [req.painelAssociado.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar recorde' });
  }
}

// Top 10 (menor tempo) do dia ou da semana, mais a posição de quem pediu
// (mesmo fora do top 10) — cada associado entra com a MELHOR partida dele
// no período, não com cada partida individual.
async function getRanking(req, res) {
  try {
    const associadoId = req.painelAssociado.id;
    const periodo = FILTROS_PERIODO[req.query.periodo] ? req.query.periodo : 'dia';
    const filtro = FILTROS_PERIODO[periodo];

    const topResult = await db.query(
      `SELECT a.id AS associado_id, a.nome_completo, MIN(m.tempo_segundos)::int AS melhor_tempo_segundos
       FROM sindicato_memoria_partidas m
       JOIN sindicato_associados a ON a.id = m.associado_id
       WHERE ${filtro}
       GROUP BY a.id, a.nome_completo
       ORDER BY melhor_tempo_segundos ASC
       LIMIT 10`
    );

    const posicaoResult = await db.query(
      `WITH ranking AS (
         SELECT a.id AS associado_id, MIN(m.tempo_segundos)::int AS melhor_tempo_segundos,
                RANK() OVER (ORDER BY MIN(m.tempo_segundos) ASC) AS posicao
         FROM sindicato_memoria_partidas m
         JOIN sindicato_associados a ON a.id = m.associado_id
         WHERE ${filtro}
         GROUP BY a.id
       )
       SELECT posicao, melhor_tempo_segundos FROM ranking WHERE associado_id = $1`,
      [associadoId]
    );

    // LGPD: nunca devolve nome_completo de outro associado — só o dono da
    // sessão vê o próprio nome de verdade (eu:true pro front destacar
    // "Você"), todo mundo mais sai anonimizado (ver anonimizarNome).
    const top10 = topResult.rows.map(row => ({
      associado_id: row.associado_id,
      nome: row.associado_id === associadoId ? row.nome_completo : anonimizarNome(row.nome_completo),
      eu: row.associado_id === associadoId,
      melhor_tempo_segundos: row.melhor_tempo_segundos,
    }));

    return res.json({
      periodo,
      top10,
      minha_posicao: posicaoResult.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
}

module.exports = { registrarPartida, getMeuRecorde, getRanking };

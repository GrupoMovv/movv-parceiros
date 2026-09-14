const db = require('../config/database');
const { anonimizarNome } = require('../utils/anonimizarNome');
const { NIVEIS, getNivel } = require('../config/memoriaNiveis');

// Filtros de periodo pro ranking — chave vem de req.query.periodo, sempre
// validada contra este whitelist antes de entrar na query (nunca
// interpolar o query param direto).
const FILTROS_PERIODO = {
  dia:    'm.data_partida::date = NOW()::date',
  semana: "date_trunc('week', m.data_partida) = date_trunc('week', NOW())",
};

function nivelDaQuery(query) {
  return getNivel(query.nivel) ? Number(query.nivel) : 1;
}

// Status de cada um dos 5 níveis pro associado logado: desbloqueado (nivel
// 1 sempre; N>1 só se completou N-1), completado, melhor tempo pessoal —
// alimenta a tela de seleção de nível e a barra de progresso no hub.
async function getMeusNiveis(req, res) {
  try {
    const result = await db.query(
      'SELECT nivel, completado, melhor_tempo, completado_em FROM sindicato_memoria_niveis WHERE associado_id = $1',
      [req.painelAssociado.id]
    );
    const porNivel = new Map(result.rows.map(r => [r.nivel, r]));

    const niveis = NIVEIS.map(cfg => {
      const registro = porNivel.get(cfg.nivel);
      const desbloqueado = cfg.nivel === 1 || porNivel.get(cfg.nivel - 1)?.completado === true;
      return {
        nivel: cfg.nivel,
        nome: cfg.nome,
        emoji: cfg.emoji,
        pares: cfg.pares,
        desbloqueado,
        completado: registro?.completado || false,
        melhor_tempo_segundos: registro?.melhor_tempo ?? null,
      };
    });

    return res.json({ niveis, niveis_completados: niveis.filter(n => n.completado).length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar níveis' });
  }
}

// Registra o resultado de uma partida completa (todas as duplas do nível
// encontradas). Sem POST intermediário por jogada — o jogo inteiro roda
// no cliente, só o resultado final é gravado. Marca o nível como
// completado e, se for a 1ª vez, devolve nivel_desbloqueado (o próximo).
async function registrarPartida(req, res) {
  try {
    const associadoId = req.painelAssociado.id;
    const cfg = getNivel(req.body.nivel);
    if (!cfg) return res.status(400).json({ error: 'nivel inválido' });
    const nivel = cfg.nivel;

    const tempo = Number(req.body.tempo_segundos);
    const jogadas = Number(req.body.jogadas);
    if (!Number.isInteger(tempo) || tempo <= 0 || tempo > 3600) {
      return res.status(400).json({ error: 'tempo_segundos inválido' });
    }
    // Mínimo de jogadas = pares do nível (acertar todas de primeira);
    // teto generoso só pra barrar payload absurdo, não pra "validar" o jogo.
    if (!Number.isInteger(jogadas) || jogadas < cfg.pares || jogadas > 1000) {
      return res.status(400).json({ error: 'jogadas inválido' });
    }

    // Defesa contra pular nível direto no POST — nível 1 é sempre livre,
    // nível N>1 exige ter completado N-1 antes (mesma regra do
    // getMeusNiveis, checada de novo aqui pra não confiar só no front).
    if (nivel > 1) {
      const anterior = await db.query(
        'SELECT completado FROM sindicato_memoria_niveis WHERE associado_id = $1 AND nivel = $2',
        [associadoId, nivel - 1]
      );
      if (!anterior.rows[0]?.completado) {
        return res.status(403).json({ error: `Nível ${nivel} ainda está bloqueado — complete o nível ${nivel - 1} primeiro` });
      }
    }

    const recordeAnterior = await db.query(
      'SELECT MIN(tempo_segundos)::int AS melhor FROM sindicato_memoria_partidas WHERE associado_id = $1 AND nivel = $2',
      [associadoId, nivel]
    );
    const melhorAnterior = recordeAnterior.rows[0].melhor;
    const novoRecorde = melhorAnterior === null || tempo < melhorAnterior;

    const result = await db.query(
      `INSERT INTO sindicato_memoria_partidas (associado_id, tempo_segundos, jogadas, nivel)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [associadoId, tempo, jogadas, nivel]
    );

    const statusAntes = await db.query(
      'SELECT completado FROM sindicato_memoria_niveis WHERE associado_id = $1 AND nivel = $2',
      [associadoId, nivel]
    );
    const jaEstavaCompletado = statusAntes.rows[0]?.completado || false;

    await db.query(
      `INSERT INTO sindicato_memoria_niveis (associado_id, nivel, completado, melhor_tempo, completado_em)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (associado_id, nivel) DO UPDATE SET
         completado = true,
         melhor_tempo = LEAST(sindicato_memoria_niveis.melhor_tempo, EXCLUDED.melhor_tempo),
         completado_em = COALESCE(sindicato_memoria_niveis.completado_em, EXCLUDED.completado_em)`,
      [associadoId, nivel, tempo]
    );

    const proximoNivel = getNivel(nivel + 1);
    const nivelDesbloqueado = !jaEstavaCompletado && proximoNivel ? proximoNivel.nivel : null;

    return res.status(201).json({
      partida: result.rows[0],
      novo_recorde: novoRecorde,
      melhor_tempo_pessoal: novoRecorde ? tempo : melhorAnterior,
      nivel_desbloqueado: nivelDesbloqueado,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar partida' });
  }
}

async function getMeuRecorde(req, res) {
  try {
    const nivel = nivelDaQuery(req.query);
    const result = await db.query(
      `SELECT MIN(tempo_segundos)::int AS melhor_tempo_segundos, COUNT(*)::int AS partidas_jogadas
       FROM sindicato_memoria_partidas WHERE associado_id = $1 AND nivel = $2`,
      [req.painelAssociado.id, nivel]
    );
    return res.json({ nivel, ...result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar recorde' });
  }
}

// Top 10 (menor tempo) do dia ou da semana PRA UM NÍVEL, mais a posição de
// quem pediu (mesmo fora do top 10) — cada associado entra com a MELHOR
// partida dele no período+nível, não com cada partida individual.
async function getRanking(req, res) {
  try {
    const associadoId = req.painelAssociado.id;
    const periodo = FILTROS_PERIODO[req.query.periodo] ? req.query.periodo : 'dia';
    const filtro = FILTROS_PERIODO[periodo];
    const nivel = nivelDaQuery(req.query);

    const topResult = await db.query(
      `SELECT a.id AS associado_id, a.nome_completo, MIN(m.tempo_segundos)::int AS melhor_tempo_segundos
       FROM sindicato_memoria_partidas m
       JOIN sindicato_associados a ON a.id = m.associado_id
       WHERE ${filtro} AND m.nivel = $1
       GROUP BY a.id, a.nome_completo
       ORDER BY melhor_tempo_segundos ASC
       LIMIT 10`,
      [nivel]
    );

    const posicaoResult = await db.query(
      `WITH ranking AS (
         SELECT a.id AS associado_id, MIN(m.tempo_segundos)::int AS melhor_tempo_segundos,
                RANK() OVER (ORDER BY MIN(m.tempo_segundos) ASC) AS posicao
         FROM sindicato_memoria_partidas m
         JOIN sindicato_associados a ON a.id = m.associado_id
         WHERE ${filtro} AND m.nivel = $2
         GROUP BY a.id
       )
       SELECT posicao, melhor_tempo_segundos FROM ranking WHERE associado_id = $1`,
      [associadoId, nivel]
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
      nivel,
      top10,
      minha_posicao: posicaoResult.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
}

module.exports = { getMeusNiveis, registrarPartida, getMeuRecorde, getRanking };

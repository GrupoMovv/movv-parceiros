const db = require('../config/database');
const { diasAte, ehHojeODiaDoEvento, deadlineConfirmacaoISO } = require('../config/fechaMes');
const { fechaMesHabilitadoGlobalmente, definirHabilitadoGlobalmente, obterProximoEvento } = require('../services/fechaMesService');

async function getProximo(req, res) {
  try {
    const habilitado = await fechaMesHabilitadoGlobalmente();
    const evento = await obterProximoEvento();

    const resumo = await db.query(
      `SELECT COUNT(DISTINCT parceiro_id)::int AS parceiros_confirmados, COUNT(*)::int AS produtos_confirmados
       FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1`,
      [evento.id]
    );

    return res.json({
      id: evento.id,
      data_evento: evento.data_evento,
      ativo: evento.ativo,
      habilitado_globalmente: habilitado,
      dias_restantes: diasAte(evento.data_evento),
      deadline_confirmacao: deadlineConfirmacaoISO(evento.data_evento),
      ativo_hoje: habilitado && evento.ativo && ehHojeODiaDoEvento(evento.data_evento),
      parceiros_confirmados: resumo.rows[0].parceiros_confirmados,
      produtos_confirmados: resumo.rows[0].produtos_confirmados,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar próximo Fecha Mês' });
  }
}

// Cancelar (ativo=false) ou adiar (nova data_evento) uma edição específica
// — não mexe nas confirmações já feitas (ficam ligadas ao mesmo id).
async function atualizarEvento(req, res) {
  try {
    const { id } = req.params;
    const { ativo, data_evento } = req.body;

    const campos = [];
    const valores = [];
    if (ativo !== undefined) { valores.push(Boolean(ativo)); campos.push(`ativo = $${valores.length}`); }
    if (data_evento) { valores.push(data_evento); campos.push(`data_evento = $${valores.length}`); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada pra atualizar' });

    valores.push(id);
    const result = await db.query(
      `UPDATE sindicato_fecha_mes SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Evento não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um Fecha Mês cadastrado pra essa data' });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar Fecha Mês' });
  }
}

async function getConfig(req, res) {
  try {
    return res.json({ habilitado: await fechaMesHabilitadoGlobalmente() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
}

async function atualizarConfig(req, res) {
  try {
    await definirHabilitadoGlobalmente(Boolean(req.body.habilitado));
    return res.json({ habilitado: Boolean(req.body.habilitado) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
}

// Últimas 6 edições passadas, visão agregada (todos os parceiros).
async function getHistorico(req, res) {
  try {
    const eventosResult = await db.query(
      `SELECT id, data_evento, ativo FROM sindicato_fecha_mes WHERE data_evento < CURRENT_DATE
       ORDER BY data_evento DESC LIMIT 6`
    );

    const historico = [];
    for (const evento of eventosResult.rows) {
      const [resumo, cliques] = await Promise.all([
        db.query(
          `SELECT COUNT(DISTINCT parceiro_id)::int AS parceiros, COUNT(*)::int AS produtos
           FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1`,
          [evento.id]
        ),
        db.query(
          `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_cliques c
           JOIN sindicato_fecha_mes_produtos fmp ON fmp.produto_id = c.produto_id AND fmp.fecha_mes_id = $1
           WHERE c.tipo = 'clique_whatsapp' AND c.criado_em::date = $2`,
          [evento.id, evento.data_evento]
        ),
      ]);
      historico.push({
        data_evento: evento.data_evento,
        ativo: evento.ativo,
        parceiros_participantes: resumo.rows[0].parceiros,
        produtos_participantes: resumo.rows[0].produtos,
        cliques_no_dia: cliques.rows[0].n,
      });
    }

    return res.json({ historico });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar histórico do Fecha Mês' });
  }
}

module.exports = { getProximo, atualizarEvento, getConfig, atualizarConfig, getHistorico };

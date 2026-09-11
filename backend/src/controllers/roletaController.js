const db = require('../config/database');
const { girarRoleta, jaJogouHoje } = require('../services/roletaService');

// Tela 1 da roleta: já jogou hoje? tem streak? — pra desenhar o estado
// inicial (botão "girar" vs. "volta amanhã") sem precisar tentar girar.
async function getStatus(req, res) {
  try {
    const associadoId = req.painelAssociado.id;
    const jaJogou = await jaJogouHoje(associadoId, 'roleta');

    const streakResult = await db.query(
      'SELECT dias_seguidos FROM sindicato_jogos_streak WHERE associado_id = $1',
      [associadoId]
    );

    // "X pessoas jogaram hoje" na tela /jogar — pessoas, não cupons (por
    // isso COUNT DISTINCT associado_id, não COUNT(*)).
    const jogaramHojeResult = await db.query(
      `SELECT COUNT(DISTINCT associado_id)::int AS total FROM sindicato_cupons_roleta
       WHERE jogo_tipo = 'roleta' AND jogado_em::date = NOW()::date`
    );

    return res.json({
      pode_jogar: !jaJogou,
      dias_seguidos: streakResult.rows[0]?.dias_seguidos || 0,
      jogaram_hoje: jogaramHojeResult.rows[0].total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar status da roleta' });
  }
}

async function girar(req, res) {
  try {
    const resultado = await girarRoleta(req.painelAssociado.id, 'roleta');
    return res.status(201).json(resultado);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao girar a roleta' });
  }
}

async function getMeusCupons(req, res) {
  try {
    const { status } = req.query;
    const params = [req.painelAssociado.id];
    let whereStatus = '';

    // "expirado" não é um status gravado — é ativo cuja validade passou.
    // Calculado na leitura (mesmo espírito do Fecha Mês: nada de cron pra
    // ficar corrigindo status no banco toda hora).
    if (status === 'ativo') {
      whereStatus = `AND c.status = 'ativo' AND c.valido_ate > NOW()`;
    } else if (status === 'usado') {
      whereStatus = `AND c.status = 'usado'`;
    } else if (status === 'expirado') {
      whereStatus = `AND c.status = 'ativo' AND c.valido_ate <= NOW()`;
    }

    const result = await db.query(
      `SELECT c.id, c.codigo_cupom, c.desconto_percentual, c.status, c.jogo_tipo,
              c.jogado_em, c.valido_ate, c.usado_em,
              p.id AS parceiro_id, p.nome AS parceiro_nome, p.logo_url AS parceiro_logo_url, p.slug AS parceiro_slug
       FROM sindicato_cupons_roleta c
       JOIN sindicato_parceiros p ON p.id = c.parceiro_id
       WHERE c.associado_id = $1 ${whereStatus}
       ORDER BY c.jogado_em DESC`,
      params
    );

    return res.json({ cupons: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar seus cupons' });
  }
}

// Auto-declarado pelo associado ("já usei, apresentei na loja") — Fase 1
// não tem validação do lado do parceiro (scanner/confirmação de caixa),
// é só marcação honesta pra organizar a lista em Ativos/Usados. Endpoint
// de resgate validado pelo parceiro fica pra uma fase futura.
async function marcarComoUsado(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE sindicato_cupons_roleta
       SET status = 'usado', usado_em = NOW()
       WHERE id = $1 AND associado_id = $2 AND status = 'ativo' AND valido_ate > NOW()
       RETURNING *`,
      [id, req.painelAssociado.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cupom não encontrado, já usado ou expirado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao marcar cupom como usado' });
  }
}

module.exports = { getStatus, girar, getMeusCupons, marcarComoUsado };

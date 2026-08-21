const db = require('../config/database');
const calc = require('../services/sindicatoCalcService');

// ─── Admin: listar todos os meses ───────────────────────────────────────────
async function listFaturamentos(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM sindicato_faturamento ORDER BY reference_month DESC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar faturamentos' });
  }
}

// ─── Admin: lançar/editar faturamento do mês (calcula o bônus) ─────────────
async function upsertFaturamento(req, res) {
  try {
    const { reference_month, faturamento_bruto } = req.body;
    if (!reference_month || faturamento_bruto === undefined) {
      return res.status(400).json({ error: 'reference_month e faturamento_bruto são obrigatórios' });
    }

    const existing = await db.query(
      'SELECT * FROM sindicato_faturamento WHERE reference_month = $1',
      [reference_month]
    );
    if (existing.rows[0] && existing.rows[0].status !== 'aberto') {
      return res.status(403).json({ error: 'Este mês já foi fechado. Reabra antes de editar.' });
    }

    const folha = calc.calcularFolha(faturamento_bruto);

    const result = await db.query(
      `INSERT INTO sindicato_faturamento (reference_month, faturamento_bruto, bonus_renan, status)
       VALUES ($1, $2, $3, 'aberto')
       ON CONFLICT (reference_month) DO UPDATE SET
         faturamento_bruto = EXCLUDED.faturamento_bruto,
         bonus_renan        = EXCLUDED.bonus_renan,
         updated_at          = NOW()
       RETURNING *`,
      [reference_month, folha.faturamento_bruto, folha.bonus_renan]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao lançar faturamento' });
  }
}

// ─── Admin: fechar o mês (trava edição, libera visualização pro Renan) ─────
async function closeFaturamento(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sindicato_faturamento WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status !== 'aberto') {
      return res.status(403).json({ error: 'Este mês já está fechado' });
    }
    const result = await db.query(
      `UPDATE sindicato_faturamento SET status = 'fechado', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao fechar mês' });
  }
}

// ─── Admin: reabrir o mês (permite corrigir o faturamento lançado) ─────────
async function reopenFaturamento(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sindicato_faturamento WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status === 'pago') {
      return res.status(403).json({ error: 'Este mês já foi pago. Estorne o pagamento antes de reabrir.' });
    }
    if (check.rows[0].status === 'aberto') {
      return res.status(403).json({ error: 'Este mês já está aberto' });
    }
    const result = await db.query(
      `UPDATE sindicato_faturamento SET status = 'aberto', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reabrir mês' });
  }
}

// ─── Admin: marcar como pago ────────────────────────────────────────────────
async function markAsPaid(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sindicato_faturamento WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status !== 'fechado') {
      return res.status(403).json({ error: 'Feche o mês antes de marcar como pago' });
    }
    const result = await db.query(
      `UPDATE sindicato_faturamento SET status = 'pago', paid_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao marcar como pago' });
  }
}

// ─── Admin: estornar pagamento (volta para fechado) ────────────────────────
async function revertPayment(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sindicato_faturamento WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status !== 'pago') {
      return res.status(403).json({ error: 'Este mês ainda não foi pago' });
    }
    const result = await db.query(
      `UPDATE sindicato_faturamento SET status = 'fechado', paid_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    console.log(`[ESTORNO] ${new Date().toISOString()} — bônus Sindicato ID ${id} (${result.rows[0].reference_month}) estornado para fechado`);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao estornar pagamento' });
  }
}

// ─── Admin: excluir lançamento (apenas enquanto aberto) ────────────────────
async function deleteFaturamento(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sindicato_faturamento WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status !== 'aberto') {
      return res.status(403).json({ error: 'Só é possível excluir lançamentos abertos. Reabra o mês primeiro.' });
    }
    await db.query('DELETE FROM sindicato_faturamento WHERE id = $1', [id]);
    return res.json({ message: 'Lançamento excluído com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir lançamento' });
  }
}

// ─── Renan: seu bônus (só meses fechados ou pagos) ──────────────────────────
async function myBonus(req, res) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const result = await db.query(
      `SELECT * FROM sindicato_faturamento
       WHERE status IN ('fechado', 'pago')
       ORDER BY reference_month DESC
       LIMIT 24`
    );
    const current = result.rows.find(r => r.reference_month === currentMonth) || null;

    return res.json({
      salario_fixo: calc.SALARIO_FIXO_RENAN,
      current_month: current,
      history: result.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar seu bônus' });
  }
}

module.exports = {
  listFaturamentos,
  upsertFaturamento,
  closeFaturamento,
  reopenFaturamento,
  markAsPaid,
  revertPayment,
  deleteFaturamento,
  myBonus,
};

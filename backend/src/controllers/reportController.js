const db = require('../config/database');

async function getMonthlyStatement(req, res) {
  const { accounting_id, month } = req.query;

  if (!accounting_id || !month) {
    return res.status(400).json({ error: 'accounting_id e month são obrigatórios' });
  }

  const accId = parseInt(accounting_id);

  if (!req.user.is_admin && req.user.id !== accId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    // 1. Accounting partner info
    const accRes = await db.query(
      `SELECT id, name, code, email, pix_key FROM partners WHERE id = $1 AND type = 'accounting'`,
      [accId]
    );
    if (!accRes.rows[0]) return res.status(404).json({ error: 'Contabilidade não encontrada' });
    const accounting = accRes.rows[0];

    // 2. Payment record for this accounting/month (most recent)
    const payRes = await db.query(
      `SELECT amount, payment_date FROM payments
       WHERE partner_id = $1 AND reference_month = $2
       ORDER BY payment_date DESC LIMIT 1`,
      [accId, month]
    );
    const payment = payRes.rows[0] || null;

    // 3. All referrals involving this accounting in this month with summed commissions
    const refRes = await db.query(`
      WITH involved AS (
        SELECT DISTINCT r.id
        FROM commissions c
        JOIN referrals r ON r.id = c.referral_id
        JOIN partners emp ON emp.id = r.partner_id
        WHERE c.reference_month = $1
          AND (c.partner_id = $2 OR emp.parent_id = $2)
      )
      SELECT
        r.id,
        r.protocol,
        r.client_name,
        COALESCE(r.operated_value::float, 0) AS operated_value,
        pr.name AS product_name,
        emp.id AS employee_id,
        emp.name AS employee_name,
        emp.code AS employee_code,
        emp.parent_id AS employee_parent_id,
        COALESCE(SUM(c.amount::float), 0) AS total_commission
      FROM referrals r
      JOIN products pr ON pr.id = r.product_id
      JOIN partners emp ON emp.id = r.partner_id
      JOIN commissions c ON c.referral_id = r.id AND c.reference_month = $1
      WHERE r.id IN (SELECT id FROM involved)
      GROUP BY r.id, r.protocol, r.client_name, r.operated_value, pr.name,
               emp.id, emp.name, emp.code, emp.parent_id
      ORDER BY r.created_at
    `, [month, accId]);

    const referrals = refRes.rows.map(r => {
      const total = parseFloat(r.total_commission);
      const isEmployee = parseInt(r.employee_parent_id) === accId;
      return {
        protocol:         r.protocol,
        client_name:      r.client_name,
        product_name:     r.product_name,
        operated_value:   r.operated_value,
        employee_name:    isEmployee ? r.employee_name : accounting.name,
        employee_code:    isEmployee ? r.employee_code : accounting.code,
        is_employee_referral: isEmployee,
        total_commission: parseFloat(total.toFixed(2)),
        funcionario_51:   isEmployee ? parseFloat((total * 0.51).toFixed(2)) : 0,
        contabilidade_34: parseFloat((total * (isEmployee ? 0.34 : 0.85)).toFixed(2)),
        imposto_15:       parseFloat((total * 0.15).toFixed(2)),
      };
    });

    // 4. Financial summary
    const totalBruto       = parseFloat(referrals.reduce((s, r) => s + r.total_commission, 0).toFixed(2));
    const funcionarioTotal = parseFloat(referrals.reduce((s, r) => s + r.funcionario_51, 0).toFixed(2));
    const imposto          = parseFloat((totalBruto * 0.15).toFixed(2));
    const contabilidadeNet = parseFloat((totalBruto - funcionarioTotal - imposto).toFixed(2));

    // 5. By-employee breakdown (only employee-type partners)
    const empMap = {};
    for (const r of referrals) {
      if (!r.is_employee_referral) continue;
      if (!empMap[r.employee_code]) {
        empMap[r.employee_code] = { name: r.employee_name, code: r.employee_code, count: 0, total: 0 };
      }
      empMap[r.employee_code].count++;
      empMap[r.employee_code].total = parseFloat((empMap[r.employee_code].total + r.funcionario_51).toFixed(2));
    }

    return res.json({
      accounting,
      month,
      payment,
      summary: { total_bruto: totalBruto, imposto, funcionario_total: funcionarioTotal, contabilidade_net: contabilidadeNet },
      by_employee: Object.values(empMap).sort((a, b) => b.total - a.total),
      referrals,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { getMonthlyStatement };

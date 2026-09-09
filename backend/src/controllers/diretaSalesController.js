const db = require('../config/database');
const diretaCalc = require('../services/diretaCalcService');

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthFromDate(dateStr) {
  return (dateStr ? new Date(dateStr) : new Date()).toISOString().slice(0, 7);
}

function quemAlterou(req) {
  return req.user?.name || req.user?.email || 'usuário';
}

// Log de auditoria — não deixa uma falha aqui derrubar a operação principal
// (a venda já foi salva/alterada; perder só o log não pode reverter isso).
async function registrarHistorico(client, { vendaId, acao, motivo, dadosAntes, dadosDepois, alteradoPor }) {
  try {
    await client.query(
      `INSERT INTO direta_sales_historico (venda_id, acao, motivo, dados_antes, dados_depois, alterado_por)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [vendaId, acao, motivo || null, dadosAntes ? JSON.stringify(dadosAntes) : null, dadosDepois ? JSON.stringify(dadosDepois) : null, alteradoPor]
    );
  } catch (err) {
    console.error('[FERNANDO] Falha ao registrar histórico da venda', vendaId, err.message);
  }
}

// ─── Listar vendas (admin: todas + filtros; Fernando: apenas as próprias) ───
async function listSales(req, res) {
  try {
    const isAdmin = !!req.user?.is_admin;
    const { collaborator_id, reference_month, tipo_venda, status } = req.query;

    const conditions = [];
    const params = [];

    if (isAdmin) {
      if (collaborator_id) { params.push(collaborator_id); conditions.push(`ds.collaborator_id = $${params.length}`); }
    } else {
      params.push(req.user.id);
      conditions.push(`ds.collaborator_id = $${params.length}`);
    }
    if (reference_month) { params.push(reference_month); conditions.push(`ds.reference_month = $${params.length}`); }
    if (tipo_venda)       { params.push(tipo_venda);       conditions.push(`ds.tipo_venda = $${params.length}`); }
    if (status)           { params.push(status);           conditions.push(`ds.status = $${params.length}`); }
    // Sem filtro de status explícito, "excluída" (venda cadastrada errada)
    // some da listagem por padrão — só aparece se alguém pedir explicitamente.
    else                  { conditions.push(`ds.status != 'excluida'`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(
      `SELECT ds.*, p.name AS contabilidade_name, p.code AS contabilidade_code
       FROM direta_sales ds
       LEFT JOIN partners p ON p.id = ds.contabilidade_id
       ${where}
       ORDER BY ds.data_venda DESC, ds.id DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar vendas' });
  }
}

async function getSale(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = !!req.user?.is_admin;

    const result = await db.query(
      `SELECT ds.*, p.name AS contabilidade_name, p.code AS contabilidade_code
       FROM direta_sales ds
       LEFT JOIN partners p ON p.id = ds.contabilidade_id
       WHERE ds.id = $1`,
      [id]
    );
    const sale = result.rows[0];
    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });
    if (!isAdmin && sale.collaborator_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta venda' });
    }
    return res.json(sale);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar venda' });
  }
}

// ─── Registrar nova venda (Fernando) ────────────────────────────────────────
// Regra nova (migration 042): contabilidade não trava mais o valor — o
// valor da venda é sempre digitado por Fernando, e a comissão da
// contabilidade (só quando tipo_venda='contabilidade') também. Ver
// diretaCalcService.calcularComissaoVenda pra base do cálculo.
async function createSale(req, res) {
  const {
    data_venda, tipo_venda, contabilidade_id,
    cliente_nome, cliente_cpf_cnpj, cliente_whatsapp,
    preco_venda, comissao_contabilidade_valor, observacoes, motivo_preco_reduzido,
  } = req.body;

  if (!tipo_venda || !['contabilidade', 'direta'].includes(tipo_venda)) {
    return res.status(400).json({ error: 'tipo_venda deve ser "contabilidade" ou "direta"' });
  }
  if (!cliente_nome?.trim()) {
    return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
  }

  const collaboratorId  = req.user.id;
  const dataVenda       = data_venda || new Date().toISOString().slice(0, 10);
  const referenceMonth  = monthFromDate(dataVenda);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const txDb = { query: (text, params) => client.query(text, params) };

    if (tipo_venda === 'contabilidade') {
      if (!contabilidade_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'contabilidade_id é obrigatório para venda via contabilidade' });
      }
      if (comissao_contabilidade_valor === undefined || comissao_contabilidade_valor === null || comissao_contabilidade_valor === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Comissão da contabilidade é obrigatória para venda via contabilidade' });
      }
      const contabRow = await client.query(
        `SELECT 1 FROM contabilidades_precos WHERE partner_id = $1 AND ativo = true`,
        [contabilidade_id]
      );
      if (!contabRow.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Contabilidade não encontrada ou inativa' });
      }
    }

    const { bloqueado, aviso } = diretaCalc.validarPreco(preco_venda);
    if (bloqueado) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: aviso });
    }

    // Preço abaixo de R$ 30 (mas acima do custo): exige justificativa do vendedor.
    if (aviso && !motivo_preco_reduzido?.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Motivo do preço reduzido é obrigatório para vendas abaixo de R$ 30,00.' });
    }

    const observacoesFinal = aviso && motivo_preco_reduzido?.trim()
      ? `[Preço reduzido] ${motivo_preco_reduzido.trim()}${observacoes ? '\n' + observacoes : ''}`
      : (observacoes || null);

    const goal = await diretaCalc.getOrCreateGoalDoMes(collaboratorId, referenceMonth, txDb);

    let calc;
    try {
      calc = diretaCalc.calcularComissaoVenda({
        tipoVenda: tipo_venda,
        valorVenda: preco_venda,
        comissaoContabilidadeValor: tipo_venda === 'contabilidade' ? comissao_contabilidade_valor : null,
        comissaoPct: goal.comissao_pct,
      });
    } catch (calcErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: calcErr.message });
    }

    const inserted = await client.query(
      `INSERT INTO direta_sales
         (collaborator_id, data_venda, tipo_venda, contabilidade_id,
          cliente_nome, cliente_cpf_cnpj, cliente_whatsapp,
          preco_venda, custo, comissao_contabilidade_valor, lucro, comissao_pct, comissao_valor,
          status, observacoes, reference_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'confirmada',$14,$15)
       RETURNING *`,
      [
        collaboratorId, dataVenda, tipo_venda, contabilidade_id || null,
        cliente_nome.trim(), cliente_cpf_cnpj || null, cliente_whatsapp || null,
        preco_venda, diretaCalc.CUSTO_CERTIFICADO, tipo_venda === 'contabilidade' ? calc.comissaoContab : null,
        calc.lucroMovv, goal.comissao_pct, calc.comissaoVendedor,
        observacoesFinal, referenceMonth,
      ]
    );
    const venda = inserted.rows[0];

    await registrarHistorico(client, {
      vendaId: venda.id, acao: 'criada', dadosDepois: venda, alteradoPor: quemAlterou(req),
    });

    await client.query('COMMIT');
    return res.status(201).json({ ...venda, aviso: aviso || undefined });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro ao registrar venda' });
  } finally {
    client.release();
  }
}

// ─── Editar venda existente (corrigir dados/valores, mesmo mês/tipo/comissao_pct) ─
// Não deixa trocar tipo_venda/contabilidade_id/data_venda por edição — isso
// muda a base do cálculo e o mês de referência (mexeria na meta batida do
// mês); se Fernando errou o tipo, o caminho é excluir e recadastrar.
async function updateSale(req, res) {
  const { id } = req.params;
  const isAdmin = !!req.user?.is_admin;
  const {
    cliente_nome, cliente_cpf_cnpj, cliente_whatsapp,
    preco_venda, comissao_contabilidade_valor, observacoes, motivo,
  } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT * FROM direta_sales WHERE id = $1 FOR UPDATE', [id]);
    const venda = check.rows[0];
    if (!venda) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venda não encontrada' }); }
    if (!isAdmin && venda.collaborator_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Acesso negado a esta venda' });
    }
    if (venda.status !== 'confirmada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Só é possível editar vendas confirmadas' });
    }
    if (cliente_nome !== undefined && !cliente_nome.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
    }

    const precoFinal = preco_venda !== undefined ? preco_venda : venda.preco_venda;
    const comissaoContabFinal = venda.tipo_venda === 'contabilidade'
      ? (comissao_contabilidade_valor !== undefined ? comissao_contabilidade_valor : venda.comissao_contabilidade_valor)
      : null;

    let calc;
    try {
      // Preserva o comissao_pct já gravado na venda (o tier do mês em que
      // ela foi feita) — editar valores não deve mudar em qual degrau de
      // comissão a venda foi contabilizada.
      calc = diretaCalc.calcularComissaoVenda({
        tipoVenda: venda.tipo_venda,
        valorVenda: precoFinal,
        comissaoContabilidadeValor: comissaoContabFinal,
        comissaoPct: venda.comissao_pct,
      });
    } catch (calcErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: calcErr.message });
    }

    const updated = await client.query(
      `UPDATE direta_sales SET
         cliente_nome = $1, cliente_cpf_cnpj = $2, cliente_whatsapp = $3,
         preco_venda = $4, comissao_contabilidade_valor = $5,
         lucro = $6, comissao_valor = $7,
         observacoes = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        cliente_nome !== undefined ? cliente_nome.trim() : venda.cliente_nome,
        cliente_cpf_cnpj !== undefined ? (cliente_cpf_cnpj || null) : venda.cliente_cpf_cnpj,
        cliente_whatsapp !== undefined ? (cliente_whatsapp || null) : venda.cliente_whatsapp,
        precoFinal, comissaoContabFinal, calc.lucroMovv, calc.comissaoVendedor,
        observacoes !== undefined ? (observacoes || null) : venda.observacoes,
        id,
      ]
    );

    await registrarHistorico(client, {
      vendaId: id, acao: 'editada', motivo: motivo?.trim() || null,
      dadosAntes: venda, dadosDepois: updated.rows[0], alteradoPor: quemAlterou(req),
    });

    await client.query('COMMIT');
    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro ao editar venda' });
  } finally {
    client.release();
  }
}

// ─── Excluir venda (soft delete — "cadastrei errado", some da listagem) ────
async function deleteSale(req, res) {
  const { id } = req.params;
  const isAdmin = !!req.user?.is_admin;
  const { motivo } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT * FROM direta_sales WHERE id = $1 FOR UPDATE', [id]);
    const venda = check.rows[0];
    if (!venda) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venda não encontrada' }); }
    if (!isAdmin && venda.collaborator_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Acesso negado a esta venda' });
    }
    if (venda.status === 'excluida') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Venda já está excluída' });
    }

    const updated = await client.query(
      `UPDATE direta_sales SET status = 'excluida', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await registrarHistorico(client, {
      vendaId: id, acao: 'excluida', motivo: motivo?.trim() || null,
      dadosAntes: venda, alteradoPor: quemAlterou(req),
    });

    await client.query('COMMIT');
    console.log(`[FERNANDO] Venda excluída — ID ${id}, cliente: ${venda.cliente_nome}`);
    return res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir venda' });
  } finally {
    client.release();
  }
}

// ─── Cancelar venda (sem recalcular % de outras vendas do mês) ──────────────
async function cancelSale(req, res) {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const isAdmin = !!req.user?.is_admin;

    await client.query('BEGIN');
    const check = await client.query('SELECT * FROM direta_sales WHERE id = $1 FOR UPDATE', [id]);
    if (!check.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venda não encontrada' }); }
    if (!isAdmin && check.rows[0].collaborator_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Acesso negado a esta venda' });
    }
    if (check.rows[0].status === 'cancelada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Venda já está cancelada' });
    }

    const result = await client.query(
      `UPDATE direta_sales SET status = 'cancelada', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    await registrarHistorico(client, {
      vendaId: id, acao: 'cancelada', dadosAntes: check.rows[0], dadosDepois: result.rows[0], alteradoPor: quemAlterou(req),
    });
    await client.query('COMMIT');
    console.log(`[FERNANDO] Venda cancelada — ID ${id}, cliente: ${check.rows[0].cliente_nome}`);
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cancelar venda' });
  } finally {
    client.release();
  }
}

// ─── Histórico de auditoria de uma venda ────────────────────────────────────
async function getSaleHistorico(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = !!req.user?.is_admin;

    const venda = await db.query('SELECT collaborator_id FROM direta_sales WHERE id = $1', [id]);
    if (!venda.rows[0]) return res.status(404).json({ error: 'Venda não encontrada' });
    if (!isAdmin && venda.rows[0].collaborator_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta venda' });
    }

    const result = await db.query(
      'SELECT * FROM direta_sales_historico WHERE venda_id = $1 ORDER BY alterado_em DESC',
      [id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar histórico' });
  }
}

// ─── Dashboard do próprio Fernando: meta do mês + folha ao vivo + recentes ──
async function getMyDashboard(req, res) {
  try {
    const collaboratorId = req.user.id;
    const month = currentMonth();

    const [goal, folha, recentSales, recentActivities] = await Promise.all([
      diretaCalc.getOrCreateGoalDoMes(collaboratorId, month, db),
      diretaCalc.calcularFolhaMensal(collaboratorId, month, db),
      db.query(
        `SELECT * FROM direta_sales WHERE collaborator_id = $1 ORDER BY data_venda DESC, id DESC LIMIT 10`,
        [collaboratorId]
      ),
      db.query(
        `SELECT * FROM sales_activities WHERE collaborator_id = $1 ORDER BY data_atividade DESC, id DESC LIMIT 10`,
        [collaboratorId]
      ),
    ]);

    const atividadesMes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'visita')::int AS visitas,
         COUNT(*)::int                                AS contatos
       FROM sales_activities
       WHERE collaborator_id = $1 AND reference_month = $2`,
      [collaboratorId, month]
    );

    return res.json({
      goal,
      folha,
      progresso: {
        certificados: folha.certificates_count,
        visitas: atividadesMes.rows[0].visitas,
        contatos: atividadesMes.rows[0].contatos,
      },
      recent_sales: recentSales.rows,
      recent_activities: recentActivities.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
}

// ─── Meta do mês atual (admin passa collaborator_id; Fernando usa o próprio) ─
async function getGoalCurrentMonth(req, res) {
  try {
    const isAdmin = !!req.user?.is_admin;
    const collaboratorId = isAdmin ? req.query.collaborator_id : req.user.id;
    if (!collaboratorId) {
      return res.status(400).json({ error: 'collaborator_id é obrigatório' });
    }
    const month = req.query.reference_month || currentMonth();

    const goal  = await diretaCalc.getOrCreateGoalDoMes(collaboratorId, month, db);
    const folha = await diretaCalc.calcularFolhaMensal(collaboratorId, month, db);

    const atividadesMes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'visita')::int AS visitas,
         COUNT(*)::int                                AS contatos
       FROM sales_activities
       WHERE collaborator_id = $1 AND reference_month = $2`,
      [collaboratorId, month]
    );

    return res.json({
      goal,
      progresso: {
        certificados: folha.certificates_count,
        visitas: atividadesMes.rows[0].visitas,
        contatos: atividadesMes.rows[0].contatos,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar meta' });
  }
}

// ─── Admin: fecha a folha do mês do Fernando (upsert em internal_commissions) ─
async function closePayroll(req, res) {
  try {
    const { collaborator_id, reference_month, notes } = req.body;
    if (!collaborator_id || !reference_month) {
      return res.status(400).json({ error: 'collaborator_id e reference_month são obrigatórios' });
    }

    const existing = await db.query(
      'SELECT status FROM internal_commissions WHERE collaborator_id = $1 AND month = $2',
      [collaborator_id, reference_month]
    );
    if (existing.rows[0]?.status === 'paid') {
      return res.status(403).json({ error: 'Este mês já foi marcado como pago. Estorne o pagamento antes de refechar.' });
    }

    const folha = await diretaCalc.calcularFolhaMensal(collaborator_id, reference_month, db);

    const result = await db.query(
      `INSERT INTO internal_commissions
         (collaborator_id, month, azul_revenue, azul_commission_pct, azul_commission,
          direta_certificates_count, direta_via_accounting, direta_via_direct, direta_commission,
          base_salary, total_amount, notes,
          azul_normal_revenue, azul_normal_commission,
          seguros_data, seguros_total_revenue, seguros_commission,
          consorcios_revenue, consorcios_commission)
       VALUES ($1,$2,0,0,0,$3,$4,$5,$6,$7,$8,$9,0,0,'[]',0,0,0,0)
       ON CONFLICT (collaborator_id, month) DO UPDATE SET
         direta_certificates_count = EXCLUDED.direta_certificates_count,
         direta_via_accounting     = EXCLUDED.direta_via_accounting,
         direta_via_direct         = EXCLUDED.direta_via_direct,
         direta_commission         = EXCLUDED.direta_commission,
         base_salary               = EXCLUDED.base_salary,
         total_amount              = EXCLUDED.total_amount,
         notes                     = EXCLUDED.notes
       RETURNING *`,
      [
        collaborator_id, reference_month,
        folha.certificates_count,
        folha.comissao_via_accounting,
        folha.comissao_via_direct,
        folha.direta_commission,
        folha.base_salary,
        folha.total_amount,
        notes || null,
      ]
    );

    console.log(`[FERNANDO] Folha fechada — mês: ${reference_month}, certificados: ${folha.certificates_count}, comissão: R$ ${folha.direta_commission}, total: R$ ${folha.total_amount}`);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao fechar folha' });
  }
}

module.exports = {
  listSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  cancelSale,
  getSaleHistorico,
  getMyDashboard,
  getGoalCurrentMonth,
  closePayroll,
};

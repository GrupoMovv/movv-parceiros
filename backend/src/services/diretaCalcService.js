const CUSTO_CERTIFICADO  = 19.90;
const SALARIO_FIXO       = 1621.00;
const LIMIAR_SEM_SALARIO = 3500.00;
const PRECO_AVISO_MINIMO = 30.00;

// Escalonamento de comissão: sobe um degrau quando bate a meta de certificados
// do mês anterior; segura no degrau atual quando não bate (nunca regride).
const TIERS_COMISSAO = [20.00, 22.50, 25.00];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Calcula lucro e comissão de uma venda individual de certificado.
function calcularComissaoVenda(precoVenda, comissaoPct) {
  const preco = parseFloat(precoVenda);
  const pct   = parseFloat(comissaoPct);

  if (isNaN(preco) || preco < CUSTO_CERTIFICADO) {
    throw new Error(`Preço de venda (R$ ${preco}) não pode ser menor que o custo do certificado (R$ ${CUSTO_CERTIFICADO.toFixed(2)}).`);
  }

  const lucro         = round2(preco - CUSTO_CERTIFICADO);
  const comissaoValor = round2(lucro * (pct / 100));

  console.log(`[FERNANDO] Nova venda registrada — preço: R$ ${preco.toFixed(2)}, custo: R$ ${CUSTO_CERTIFICADO.toFixed(2)}, lucro: R$ ${lucro.toFixed(2)}, comissão: ${pct}% = R$ ${comissaoValor.toFixed(2)}`);

  return { lucro, comissaoValor };
}

// Duas travas de segurança de preço: bloqueia abaixo do custo, avisa abaixo de R$30.
function validarPreco(precoVenda) {
  const preco = parseFloat(precoVenda);

  if (isNaN(preco) || preco < CUSTO_CERTIFICADO) {
    return {
      bloqueado: true,
      aviso: `Preço de venda não pode ser menor que o custo do certificado (R$ ${CUSTO_CERTIFICADO.toFixed(2)}).`,
    };
  }

  if (preco < PRECO_AVISO_MINIMO) {
    return {
      bloqueado: false,
      aviso: `Preço abaixo de R$ ${PRECO_AVISO_MINIMO.toFixed(2)} — lucro reduzido nesta venda. Confirme antes de continuar.`,
    };
  }

  return { bloqueado: false, aviso: null };
}

// Busca a meta do mês; se ainda não existir, cria a partir do escalonamento
// avaliado sobre o mês anterior (chamado sob demanda na 1ª venda do mês e
// pelos endpoints de dashboard/resumo).
async function getOrCreateGoalDoMes(collaboratorId, referenceMonth, db) {
  const existing = await db.query(
    'SELECT * FROM sales_goals WHERE collaborator_id = $1 AND reference_month = $2',
    [collaboratorId, referenceMonth]
  );
  if (existing.rows[0]) return existing.rows[0];

  const previous = await db.query(
    `SELECT * FROM sales_goals
     WHERE collaborator_id = $1 AND reference_month < $2
     ORDER BY reference_month DESC
     LIMIT 1`,
    [collaboratorId, referenceMonth]
  );

  let metaCertificados = 30;
  let metaVisitas       = 40;
  let metaContatos      = 100;
  let comissaoPct       = TIERS_COMISSAO[0];

  if (previous.rows[0]) {
    const prev = previous.rows[0];
    metaCertificados = prev.meta_certificados;
    metaVisitas       = prev.meta_visitas;
    metaContatos       = prev.meta_contatos;

    const atingido = await db.query(
      `SELECT COUNT(*)::int AS qtd FROM direta_sales
       WHERE collaborator_id = $1 AND reference_month = $2 AND status = 'confirmada'`,
      [collaboratorId, prev.reference_month]
    );
    const bateuMeta = atingido.rows[0].qtd >= prev.meta_certificados;

    const idxAtual = TIERS_COMISSAO.indexOf(parseFloat(prev.comissao_pct));
    const idxBase  = idxAtual === -1 ? 0 : idxAtual;
    comissaoPct = bateuMeta
      ? TIERS_COMISSAO[Math.min(idxBase + 1, TIERS_COMISSAO.length - 1)]
      : TIERS_COMISSAO[idxBase];
  }

  const inserted = await db.query(
    `INSERT INTO sales_goals
       (collaborator_id, reference_month, meta_certificados, meta_visitas, meta_contatos, comissao_pct)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (collaborator_id, reference_month) DO NOTHING
     RETURNING *`,
    [collaboratorId, referenceMonth, metaCertificados, metaVisitas, metaContatos, comissaoPct]
  );
  if (inserted.rows[0]) return inserted.rows[0];

  // Corrida entre requisições concorrentes: outra chamada já inseriu a linha.
  const final = await db.query(
    'SELECT * FROM sales_goals WHERE collaborator_id = $1 AND reference_month = $2',
    [collaboratorId, referenceMonth]
  );
  return final.rows[0];
}

// Fecha a folha do mês: soma as vendas confirmadas e aplica a regra do salário fixo.
async function calcularFolhaMensal(collaboratorId, referenceMonth, db) {
  const result = await db.query(
    `SELECT
       COUNT(*)::int                                              AS certificates_count,
       COUNT(*) FILTER (WHERE tipo_venda = 'contabilidade')::int   AS via_accounting_count,
       COUNT(*) FILTER (WHERE tipo_venda = 'direta')::int          AS via_direct_count,
       COALESCE(SUM(lucro), 0)          AS lucro_total,
       COALESCE(SUM(comissao_valor), 0) AS comissao_total,
       COALESCE(SUM(comissao_valor) FILTER (WHERE tipo_venda = 'contabilidade'), 0) AS comissao_via_accounting,
       COALESCE(SUM(comissao_valor) FILTER (WHERE tipo_venda = 'direta'), 0)        AS comissao_via_direct
     FROM direta_sales
     WHERE collaborator_id = $1 AND reference_month = $2 AND status = 'confirmada'`,
    [collaboratorId, referenceMonth]
  );

  const row           = result.rows[0];
  const comissaoTotal = round2(parseFloat(row.comissao_total));
  const baseSalary    = comissaoTotal >= LIMIAR_SEM_SALARIO ? 0 : SALARIO_FIXO;
  const totalAmount   = round2(comissaoTotal + baseSalary);

  return {
    collaborator_id:         collaboratorId,
    reference_month:         referenceMonth,
    certificates_count:      row.certificates_count,
    via_accounting_count:    row.via_accounting_count,
    via_direct_count:        row.via_direct_count,
    lucro_total:             round2(parseFloat(row.lucro_total)),
    comissao_via_accounting: round2(parseFloat(row.comissao_via_accounting)),
    comissao_via_direct:     round2(parseFloat(row.comissao_via_direct)),
    direta_commission:       comissaoTotal,
    base_salary:             baseSalary,
    total_amount:            totalAmount,
  };
}

module.exports = {
  CUSTO_CERTIFICADO,
  SALARIO_FIXO,
  LIMIAR_SEM_SALARIO,
  TIERS_COMISSAO,
  calcularComissaoVenda,
  validarPreco,
  getOrCreateGoalDoMes,
  calcularFolhaMensal,
};

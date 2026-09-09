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

// Regra nova (a partir da migration 042): contabilidade não tem mais preço
// fixo — Fernando negocia o valor da venda (e, se for via contabilidade, a
// comissão da contabilidade) caso a caso. Isso muda a BASE sobre a qual o
// escalonamento de comissão (20/22,5/25%, ver getOrCreateGoalDoMes) incide:
//   - venda direta:        base = valor_venda
//   - venda via contab.:   base = valor_venda - comissao_contabilidade
// Antes (vendas anteriores a esta migration, não recalculadas) a base era
// sempre (valor_venda - custo_certificado), igual pros dois tipos.
//
// custo_certificado continua fixo em R$19,90 e não entra mais na base da
// comissão — só no lucro final da Movv.
//
// Mesma fórmula serve pro Token (migration 043) — só troca o "custo" (fixo
// pro certificado, variável pro token, informado por Fernando em cada
// venda) e o rótulo. Ver calcularVenda, que aplica isso duas vezes (cert
// sempre, token quando incluído) com o MESMO percentual de comissão do mês.
function calcularBaseEComissao(valorVenda, comissaoContabilidadeValor, tipoVenda, comissaoPct) {
  const preco = parseFloat(valorVenda);
  const pct   = parseFloat(comissaoPct);

  let comissaoContab = 0;
  if (tipoVenda === 'contabilidade') {
    comissaoContab = parseFloat(comissaoContabilidadeValor);
    if (isNaN(comissaoContab) || comissaoContab < 0) {
      throw new Error('Comissão da contabilidade inválida.');
    }
    if (comissaoContab > preco) {
      throw new Error('Comissão da contabilidade não pode ser maior que o valor da venda.');
    }
  }

  const base            = round2(preco - comissaoContab);
  const comissaoVendedor = round2(base * (pct / 100));

  return { base, comissaoContab, comissaoVendedor };
}

// Só o certificado (mantido pra quem ainda chama assim — ver updateSale).
function calcularComissaoVenda({ tipoVenda, valorVenda, comissaoContabilidadeValor, comissaoPct }) {
  const preco = parseFloat(valorVenda);
  if (isNaN(preco) || preco < CUSTO_CERTIFICADO) {
    throw new Error(`Valor de venda (R$ ${preco}) não pode ser menor que o custo do certificado (R$ ${CUSTO_CERTIFICADO.toFixed(2)}).`);
  }

  const { base, comissaoContab, comissaoVendedor } = calcularBaseEComissao(preco, comissaoContabilidadeValor, tipoVenda, comissaoPct);
  const lucroMovv = round2(preco - CUSTO_CERTIFICADO - comissaoContab - comissaoVendedor);

  console.log(`[FERNANDO] Venda ${tipoVenda} — valor: R$ ${preco.toFixed(2)}, comissão contab: R$ ${comissaoContab.toFixed(2)}, base: R$ ${base.toFixed(2)}, comissão (${comissaoPct}%): R$ ${comissaoVendedor.toFixed(2)}, lucro Movv: R$ ${lucroMovv.toFixed(2)}`);

  return { base, comissaoContab, comissaoVendedor, lucroMovv };
}

// Venda completa: certificado (sempre) + token (opcional, migration 043).
// Mesmo % de comissão do mês aplica nos dois produtos, separadamente —
// cada um com sua própria base (valor - comissão da contabilidade daquele
// produto, quando for venda via contabilidade) e seu próprio "custo"
// (fixo R$19,90 pro certificado; o que Fernando pagou pelo token, variável).
function calcularVenda({
  tipoVenda, comissaoPct,
  valorVendaCertificado, comissaoContabCertificado,
  incluiuToken, valorCompraToken, valorVendaToken, comissaoContabToken,
}) {
  const precoCert = parseFloat(valorVendaCertificado);
  if (isNaN(precoCert) || precoCert < CUSTO_CERTIFICADO) {
    throw new Error(`Valor de venda do certificado (R$ ${precoCert}) não pode ser menor que o custo (R$ ${CUSTO_CERTIFICADO.toFixed(2)}).`);
  }
  const cert = calcularBaseEComissao(precoCert, comissaoContabCertificado, tipoVenda, comissaoPct);
  const lucroCert = round2(precoCert - CUSTO_CERTIFICADO - cert.comissaoContab - cert.comissaoVendedor);

  let token = { valorVenda: 0, valorCompra: 0, base: 0, comissaoContab: 0, comissaoVendedor: 0, lucro: 0 };
  if (incluiuToken) {
    const precoToken  = parseFloat(valorVendaToken);
    const compraToken = parseFloat(valorCompraToken);
    if (isNaN(compraToken) || compraToken < 0) throw new Error('Valor de compra do token é obrigatório.');
    if (isNaN(precoToken) || precoToken <= compraToken) throw new Error('Valor de venda do token deve ser maior que o valor de compra.');

    const t = calcularBaseEComissao(precoToken, comissaoContabToken, tipoVenda, comissaoPct);
    const lucroToken = round2(precoToken - compraToken - t.comissaoContab - t.comissaoVendedor);
    token = { valorVenda: precoToken, valorCompra: compraToken, base: t.base, comissaoContab: t.comissaoContab, comissaoVendedor: t.comissaoVendedor, lucro: lucroToken };
  }

  const totalVenda    = round2(precoCert + token.valorVenda);
  const totalComissao = round2(cert.comissaoVendedor + token.comissaoVendedor);
  const totalLucro     = round2(lucroCert + token.lucro);

  return {
    certificado: { valorVenda: precoCert, base: cert.base, comissaoContab: cert.comissaoContab, comissaoVendedor: cert.comissaoVendedor, lucro: lucroCert },
    token,
    totalVenda, totalComissao, totalLucro,
  };
}

// Duas travas de segurança de preço: bloqueia abaixo do custo, avisa abaixo de R$30.
// (Continua olhando só o valor_venda cheio, independente do tipo — a comissão
// da contabilidade é validada à parte em calcularComissaoVenda.)
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
// Soma as colunas total_* (certificado + token, migration 043) — não
// lucro/comissao_valor direto, que são só do certificado — pra folha
// contar o token também. Vendas de antes da migration 043 têm total_*
// espelhando o valor de certificado (backfill), então soma igual pra
// venda antiga ou nova sem tratamento especial.
async function calcularFolhaMensal(collaboratorId, referenceMonth, db) {
  const result = await db.query(
    `SELECT
       COUNT(*)::int                                              AS certificates_count,
       COUNT(*) FILTER (WHERE tipo_venda = 'contabilidade')::int   AS via_accounting_count,
       COUNT(*) FILTER (WHERE tipo_venda = 'direta')::int          AS via_direct_count,
       COALESCE(SUM(total_lucro_movv), 0)          AS lucro_total,
       COALESCE(SUM(total_comissao_vendedor), 0) AS comissao_total,
       COALESCE(SUM(total_comissao_vendedor) FILTER (WHERE tipo_venda = 'contabilidade'), 0) AS comissao_via_accounting,
       COALESCE(SUM(total_comissao_vendedor) FILTER (WHERE tipo_venda = 'direta'), 0)        AS comissao_via_direct
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
  calcularVenda,
  validarPreco,
  getOrCreateGoalDoMes,
  calcularFolhaMensal,
};

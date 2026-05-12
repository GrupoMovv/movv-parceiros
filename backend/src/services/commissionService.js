const BPO_MONTHLY_VALUE    = 1399.0;
const BPO_FIRST_AMOUNT     = 650;
const BPO_RECURRING_AMOUNT = 70;
const FALLBACK_RATE        = 0.01;

// Novo modelo 51/34/15:
// - Funcionário recebe 51% do bruto
// - Contabilidade recebe 49% (34% líquido + 15% imposto que ela retém para tributos)
// - A contabilidade recebe 100% do total via PIX e distribui internamente
const EMPLOYEE_SPLIT     = 0.51;
const ACCOUNTING_SPLIT   = 0.49; // 34% líquido + 15% imposto

function calculateCommissions(product, operatedValue, partner, parentPartner, bpoMonthCount = 1) {
  const commissions = [];

  if (product.type === 'bpo') {
    const totalAmount    = bpoMonthCount === 1 ? BPO_FIRST_AMOUNT : BPO_RECURRING_AMOUNT;
    const commissionType = bpoMonthCount === 1 ? 'bpo_first' : 'bpo_recurring';
    if (partner.type === 'employee' && parentPartner) {
      commissions.push({ partner_id: partner.id,       amount: parseFloat((totalAmount * EMPLOYEE_SPLIT).toFixed(2)),   type: commissionType });
      commissions.push({ partner_id: parentPartner.id, amount: parseFloat((totalAmount * ACCOUNTING_SPLIT).toFixed(2)), type: 'accounting' });
    } else {
      commissions.push({ partner_id: partner.id, amount: parseFloat(totalAmount.toFixed(2)), type: commissionType });
    }
    return commissions;
  }

  const rate  = parseFloat(product.percentual_repasse) || parseFloat(product.commission_rate) || FALLBACK_RATE;
  const total = operatedValue * rate;

  if (partner.type === 'employee' && parentPartner) {
    commissions.push({ partner_id: partner.id,       amount: parseFloat((total * EMPLOYEE_SPLIT).toFixed(2)),   type: 'employee' });
    commissions.push({ partner_id: parentPartner.id, amount: parseFloat((total * ACCOUNTING_SPLIT).toFixed(2)), type: 'accounting' });
  } else if (partner.type === 'accounting') {
    // Contabilidade indicando direta: recebe 100% (85% líq. + 15% imposto)
    commissions.push({ partner_id: partner.id, amount: parseFloat(total.toFixed(2)), type: 'accounting' });
  }

  return commissions;
}

module.exports = { calculateCommissions, BPO_MONTHLY_VALUE, BPO_FIRST_AMOUNT, BPO_RECURRING_AMOUNT, EMPLOYEE_SPLIT, ACCOUNTING_SPLIT };

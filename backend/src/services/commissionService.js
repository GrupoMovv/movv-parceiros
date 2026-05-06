const BPO_MONTHLY_VALUE = 1399.0;
const STANDARD_COMMISSION_RATE = 0.01;
const EMPLOYEE_SPLIT = 0.60;
const ACCOUNTING_SPLIT = 0.40;
const BPO_FIRST_MONTH_RATE = 0.50;
const BPO_RECURRING_RATE = 0.05;

function calculateCommissions(product, operatedValue, partner, parentPartner, bpoMonthCount = 1) {
  const commissions = [];

  if (product.type === 'digital_certificate') {
    const accountingPartnerId = partner.type === 'accounting' ? partner.id : parentPartner?.id;
    if (accountingPartnerId) {
      commissions.push({
        partner_id: accountingPartnerId,
        amount: operatedValue * STANDARD_COMMISSION_RATE,
        type: 'accounting_full',
      });
    }
    return commissions;
  }

  if (product.type === 'bpo') {
    const rate = bpoMonthCount === 1 ? BPO_FIRST_MONTH_RATE : BPO_RECURRING_RATE;
    const commissionType = bpoMonthCount === 1 ? 'bpo_first' : 'bpo_recurring';
    commissions.push({
      partner_id: partner.id,
      amount: BPO_MONTHLY_VALUE * rate,
      type: commissionType,
    });
    return commissions;
  }

  const total = operatedValue * STANDARD_COMMISSION_RATE;

  if (partner.type === 'employee' && parentPartner) {
    commissions.push({
      partner_id: partner.id,
      amount: parseFloat((total * EMPLOYEE_SPLIT).toFixed(2)),
      type: 'employee',
    });
    commissions.push({
      partner_id: parentPartner.id,
      amount: parseFloat((total * ACCOUNTING_SPLIT).toFixed(2)),
      type: 'accounting',
    });
  } else if (partner.type === 'accounting') {
    commissions.push({
      partner_id: partner.id,
      amount: parseFloat(total.toFixed(2)),
      type: 'accounting',
    });
  }

  return commissions;
}

module.exports = { calculateCommissions, BPO_MONTHLY_VALUE };

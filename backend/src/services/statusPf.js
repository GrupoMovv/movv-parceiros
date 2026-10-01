const { PLANOS, ehPlanoPf, sqlPlanoVigente } = require('../config/planos');

// Vendedor Pessoa Física só aparece no site com plano pago (Junior, 01/10):
// aprovado + plano PF vigente (ou cortesia interna) = 'ativo'; aprovado sem
// plano = 'aguardando_plano' — entra no painel, monta anúncios e assina, mas
// como toda listagem pública exige status 'ativo', nada dele aparece.
// 'pausado' (pausa do próprio vendedor) e 'em_verificacao' não são mexidos.

const PLANOS_PF_SQL = Object.keys(PLANOS).filter(ehPlanoPf).map(p => `'${p}'`).join(', ');
const SQL_PF_PODE_APARECER = `(cortesia_interna OR (plano IN (${PLANOS_PF_SQL}) AND ${sqlPlanoVigente()}))`;

// Acerta o status de UM parceiro (não faz nada se não for PF aprovado).
// `cx` = conexão da transação de quem chama (ou o db).
async function sincronizarStatusPf(cx, parceiroId) {
  const r = await cx.query(
    `UPDATE sindicato_parceiros
        SET status = CASE WHEN ${SQL_PF_PODE_APARECER} THEN 'ativo' ELSE 'aguardando_plano' END, updated_at = NOW()
      WHERE id = $1 AND tipo_pessoa = 'pf' AND identidade_status = 'aprovada' AND status IN ('ativo', 'aguardando_plano')
      RETURNING status`,
    [parceiroId]
  );
  return r.rows[0]?.status || null;
}

// Varredura da rotina diária: PF ativo cujo plano venceu sai do ar (rede de
// segurança — o caminho normal já sincroniza no pagamento/vencimento).
async function tirarDoArPfSemPlano(cx) {
  const r = await cx.query(
    `UPDATE sindicato_parceiros SET status = 'aguardando_plano', updated_at = NOW()
      WHERE tipo_pessoa = 'pf' AND status = 'ativo' AND NOT ${SQL_PF_PODE_APARECER}
      RETURNING id`
  );
  return r.rows.map(x => x.id);
}

module.exports = { sincronizarStatusPf, tirarDoArPfSemPlano, SQL_PF_PODE_APARECER };

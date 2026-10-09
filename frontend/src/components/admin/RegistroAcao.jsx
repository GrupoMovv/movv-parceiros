// Quem fez a última ação de dinheiro na linha (aprovou, cancelou, voltou,
// pagou), vinda da tabela admin_acoes (migration 088). Linhas de antes do
// registro não têm autor e não mostram nada.
const ROTULO = {
  comissao_aprovada: 'Aprovada',
  comissao_cancelada: 'Cancelada',
  comissao_voltou: 'Voltou para pendente',
  comissao_paga: 'Paga',
  pagamento_registrado: 'Registrado',
  comissao_interna_lancada: 'Lançada',
  comissao_interna_editada: 'Editada',
  comissao_interna_paga: 'Paga',
  comissao_interna_estornada: 'Estornada',
  indicacao_aprovada: 'Aprovada',
  indicacao_cancelada: 'Cancelada',
  pagamento_indicador_criado: 'Registrado',
  pagamento_indicador_pago: 'Pago',
};

function dataHora(v) {
  return new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export default function RegistroAcao({ item, className = '' }) {
  if (!item?.ultima_acao_por) return null;
  return (
    <p className={`text-[11px] text-slate-400 mt-1 whitespace-nowrap ${className}`} title={`${ROTULO[item.ultima_acao] || 'Alterada'} por ${item.ultima_acao_por} em ${dataHora(item.ultima_acao_em)}`}>
      {ROTULO[item.ultima_acao] || 'Alterada'} por {item.ultima_acao_por.replace(/ \(.*\)$/, '')} · {dataHora(item.ultima_acao_em)}
    </p>
  );
}

// Rótulos e formatação do livro de comissões do MOVV Partner (Partner e admin).
// Valores chegam do servidor como texto ("40.03"); somas no navegador são
// feitas em centavos inteiros, nunca em float.

export const STATUS_LANC = {
  previsto:   { rotulo: 'Previsto',   classe: 'bg-slate-100 text-slate-600 border-slate-200', explica: 'A venda foi registrada; a comissão ainda depende da confirmação do pagamento.' },
  confirmado: { rotulo: 'Confirmado', classe: 'bg-amber-50 text-amber-700 border-amber-200', explica: 'O Grupo já recebeu; aguarda a aprovação da Central.' },
  aprovado:   { rotulo: 'Aprovado',   classe: 'bg-blue-50 text-movv-900 border-blue-200',    explica: 'Aprovado para pagamento.' },
  pago:       { rotulo: 'Pago',       classe: 'bg-emerald-50 text-emerald-700 border-emerald-200', explica: 'Pago a você.' },
  estornado:  { rotulo: 'Estornado',  classe: 'bg-red-50 text-red-600 border-red-200',       explica: 'Cancelado; não entra no pagamento.' },
};

export const ORIGEM = {
  azul: 'Azul',
  certificado: 'Movv Certificado',
  seguro: 'Seguros',
  movv_cred: 'MOVV CRED',
  federal_invest: 'Federal Invest',
  seguro_auto: 'Seguro de carro',
};

export const BASE = {
  comissao_recebida: 'da comissão que o Grupo recebe',
  valor_venda: 'do valor da venda',
  lucro_grupo: 'do lucro do Grupo na venda (preço − custos)',
};

export const NIVEIS = { mobile: 'Mobile', point: 'Point', hub: 'Hub', regional: 'Regional' };

// "40.03" -> 4003 (sem float)
export function centavos(v) {
  const m = String(v ?? '0').trim().match(/^(-?)(\d+)(?:\.(\d{0,2}))?/);
  if (!m) return 0;
  const n = Number(m[2]) * 100 + Number((m[3] || '').padEnd(2, '0'));
  return m[1] ? -n : n;
}

export function reais(v) {
  const c = typeof v === 'number' ? v : centavos(v);
  const abs = Math.abs(c);
  const inteiro = Math.floor(abs / 100).toLocaleString('pt-BR');
  return `${c < 0 ? '-' : ''}R$ ${inteiro},${String(abs % 100).padStart(2, '0')}`;
}

// "30.0000" -> "30%"; "12.5000" -> "12,5%"
export function pct(v) {
  const s = String(v ?? '0').replace(/\.?0+$/, '');
  return `${s.replace('.', ',')}%`;
}

export function competenciaBR(c) {
  if (!c) return '—';
  const [a, m] = c.split('-');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[Number(m) - 1]}/${a}`;
}

export function dataBR(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

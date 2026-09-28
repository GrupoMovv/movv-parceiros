// Rótulos e datas do Pet parte 3 (ficha + pedido de horário) — usados no
// /meu (cliente), no ServicoDetalhe e no painel do pet shop.

export const STATUS_PEDIDO = {
  pendente:   { label: 'Aguardando o pet shop', emoji: '⏳', cor: '#92400E', fundo: '#FEF3C7' },
  proposta:   { label: 'Pet shop propôs outro horário', emoji: '🔄', cor: '#1E40AF', fundo: '#DBEAFE' },
  confirmado: { label: 'Confirmado', emoji: '✅', cor: '#166534', fundo: '#DCFCE7' },
  recusado:   { label: 'Não vai dar', emoji: '❌', cor: '#991B1B', fundo: '#FEE2E2' },
  cancelado:  { label: 'Cancelado', emoji: '🚫', cor: '#475569', fundo: '#F1F5F9' },
};

export const PERIODOS = [
  { codigo: 'manha', nome: 'Manhã' },
  { codigo: 'tarde', nome: 'Tarde' },
  { codigo: 'noite', nome: 'Noite' },
];
export const nomePeriodo = c => PERIODOS.find(p => p.codigo === c)?.nome || c;

// "YYYY-MM-DD" -> "qui, 01/10" (sem fuso: a data é só o dia)
export function dataCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  const sem = new Date(Date.UTC(+a, +m - 1, +d)).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${sem}, ${d}/${m}`;
}
export const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

// Hoje e hoje+N em Itumbiara, "YYYY-MM-DD" (pro min/max do <input type=date>)
export function hojeSP(deslocDias = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + deslocDias * 864e5));
}

export function idadePet(nascimento, aproximado) {
  if (!nascimento) return null;
  const [a, m] = String(nascimento).split('-').map(Number);
  const hoje = new Date();
  let meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  if (meses < 0) return null;
  const txt = meses < 12 ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : `${Math.floor(meses / 12)} ${Math.floor(meses / 12) === 1 ? 'ano' : 'anos'}`;
  return aproximado ? `~${txt}` : txt;
}

export const emojiEspecie = e => ({ cao: '🐶', gato: '🐱' }[e] || '🐾');

export function formatarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || '';
}

// Helpers do IUB Food compartilhados entre painel (Meu Perfil, Entrega) e
// marketplace (/marketplace/food, /food/:slug). horario_funcionamento tem
// o formato da migration 025:
//   {"seg": {"aberto": true, "abre": "18:00", "fecha": "23:00"}, ...}

export const DIAS = [
  { chave: 'seg', label: 'Segunda' }, { chave: 'ter', label: 'Terça' }, { chave: 'qua', label: 'Quarta' },
  { chave: 'qui', label: 'Quinta' }, { chave: 'sex', label: 'Sexta' }, { chave: 'sab', label: 'Sábado' },
  { chave: 'dom', label: 'Domingo' },
];
const DIAS_POR_INDICE = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const INDICE_WEEKDAY_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const FUSO = 'America/Sao_Paulo';

// Dia/hora "de Itumbiara", não do aparelho — quem abre o app viajando (ou
// com o relógio do celular em outro fuso) ainda vê o restaurante aberto/
// fechado de verdade.
function agoraNoFuso(agora) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(agora).map(p => [p.type, p.value])
  );
  return { diaIdx: INDICE_WEEKDAY_EN[partes.weekday], minutos: parseInt(partes.hour, 10) * 60 + parseInt(partes.minute, 10) };
}

function paraMinutos(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function diaValido(info) {
  return Boolean(info?.aberto && paraMinutos(info.abre) !== null && paraMinutos(info.fecha) !== null);
}

export function horarioConfigurado(horario) {
  return Object.values(horario || {}).some(diaValido);
}

// null = restaurante ainda não configurou horário (não dá pra afirmar
// aberto nem fechado — quem chama NÃO deve bloquear pedido nesse caso).
// fecha < abre = vira a noite (pizzaria 18:00-02:00): de madrugada quem
// "está aberto" é o expediente de ONTEM.
export function statusFuncionamento(horario, agora = new Date()) {
  if (!horarioConfigurado(horario)) return null;
  const { diaIdx, minutos } = agoraNoFuso(agora);
  const hoje = horario[DIAS_POR_INDICE[diaIdx]];
  const ontem = horario[DIAS_POR_INDICE[(diaIdx + 6) % 7]];

  if (diaValido(ontem)) {
    const a = paraMinutos(ontem.abre); const f = paraMinutos(ontem.fecha);
    if (f < a && minutos < f) return { aberto: true, fechaAs: ontem.fecha, texto: `Aberto agora · fecha às ${ontem.fecha}` };
  }
  if (diaValido(hoje)) {
    const a = paraMinutos(hoje.abre); const f = paraMinutos(hoje.fecha);
    const abertoAgora = f > a ? minutos >= a && minutos < f : minutos >= a;
    if (abertoAgora) return { aberto: true, fechaAs: hoje.fecha, texto: `Aberto agora · fecha às ${hoje.fecha}` };
    if (minutos < a) return fechado(`hoje às ${hoje.abre}`);
  }
  for (let i = 1; i <= 7; i++) {
    const chave = DIAS_POR_INDICE[(diaIdx + i) % 7];
    if (diaValido(horario[chave])) {
      const rotulo = i === 1 ? 'amanhã' : DIAS.find(d => d.chave === chave).label.toLowerCase();
      return fechado(`${rotulo} às ${horario[chave].abre}`);
    }
  }
  return null; // inalcançável: horarioConfigurado garante ao menos 1 dia
}

function fechado(proximaAbertura) {
  return { aberto: false, proximaAbertura, texto: `Fechado · abre ${proximaAbertura}` };
}

export function formatarBRL(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "Entrega grátis" / "Entrega R$ 5,00" / "Entrega R$ 5,00 · grátis acima de R$ 50,00"
export function textoTaxaEntrega(r) {
  const taxa = parseFloat(r?.taxa_entrega);
  const gratisAcima = parseFloat(r?.entrega_gratis_acima);
  if (!Number.isFinite(taxa) || taxa <= 0) return 'Entrega grátis';
  const base = `Entrega ${formatarBRL(taxa)}`;
  return Number.isFinite(gratisAcima) && gratisAcima > 0 ? `${base} · grátis acima de ${formatarBRL(gratisAcima)}` : base;
}

// tempo_preparo_min (tela Entrega) tem prioridade; duracao_media é o
// texto livre antigo (migration 049) que alguns restaurantes já usavam
// como "tempo de entrega" antes da tela existir.
export function textoTempoPreparo(r) {
  if (r?.tempo_preparo_min) return `~${r.tempo_preparo_min} min`;
  return r?.duracao_media || null;
}

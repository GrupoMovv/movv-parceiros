// Calendário do pagamento do MOVV Partner (Junior, 14/10/2026). Só
// informativo: não bloqueia nem altera nada no livro de comissões.
//
// Política: o mês fecha do dia 1 ao último dia; o Partner recebe até o 5º
// dia útil do mês seguinte. Dia útil = segunda a sexta, fora os feriados:
//   - nacionais fixos: 1/1, 21/4, 1/5, 7/9, 12/10, 2/11, 15/11, 20/11
//     (Consciência Negra, nacional desde 2024) e 25/12;
//   - móveis: Sexta-feira Santa e Carnaval (segunda e terça), que os bancos
//     não abrem. Corpus Christi NÃO conta (ponto facultativo; bancos abrem).
// Os móveis saem da Páscoa, calculada para qualquer ano.

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

const iso = d => d.toISOString().slice(0, 10);
const somarDias = (d, n) => new Date(d.getTime() + n * 86400000);

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const cache = new Map();
// Feriados do ano: Map 'AAAA-MM-DD' -> nome
function feriados(ano) {
  if (cache.has(ano)) return cache.get(ano);
  const p = pascoa(ano);
  const lista = new Map();
  for (const md of FIXOS) {
    if (md === '11-20' && ano < 2024) continue;
    lista.set(`${ano}-${md}`, 'feriado nacional');
  }
  lista.set(iso(somarDias(p, -48)), 'Carnaval (segunda)');
  lista.set(iso(somarDias(p, -47)), 'Carnaval (terça)');
  lista.set(iso(somarDias(p, -2)), 'Sexta-feira Santa');
  cache.set(ano, lista);
  return lista;
}

function ehDiaUtil(d) {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !feriados(d.getUTCFullYear()).has(iso(d));
}

// n-ésimo dia útil do mês (mes 1..12) -> 'AAAA-MM-DD'
function enesimoDiaUtil(ano, mes, n) {
  let d = new Date(Date.UTC(ano, mes - 1, 1));
  let conta = 0;
  while (d.getUTCMonth() === mes - 1) {
    if (ehDiaUtil(d) && ++conta === n) return iso(d);
    d = somarDias(d, 1);
  }
  throw new Error(`O mês ${ano}-${mes} não tem ${n} dias úteis`);
}

// Mês fechado 'AAAA-MM' -> data-limite do pagamento (5º dia útil do mês seguinte)
function dataLimitePagamento(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  return enesimoDiaUtil(ano, mes, 5);
}

module.exports = { pascoa, feriados, ehDiaUtil, enesimoDiaUtil, dataLimitePagamento };

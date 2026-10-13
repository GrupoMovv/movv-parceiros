// Dinheiro sem float (livro de comissões do Partner, 13/10/2026): valores em
// centavos inteiros (BigInt), percentuais em décimos de milésimo (4 casas,
// igual ao NUMERIC(7,4) do banco). O pg devolve NUMERIC como string
// ("133.44"), que entra aqui direto, sem passar por Number.

// "133.44" | "133,4" | 133.44 | "1.234,56"? NÃO: aqui só formato canônico,
// com ponto decimal e sem separador de milhar (o que vem do banco e dos
// formulários). Leitura de planilha tem o próprio normalizador.
function paraEscala(valor, casas) {
  if (valor === null || valor === undefined || valor === '') throw new Error('Valor vazio');
  const s = typeof valor === 'number' ? valor.toFixed(casas + 2) : String(valor).trim();
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error(`Valor inválido: ${s}`);
  const [, sinal, inteiro, frac = ''] = m;
  // arredonda o excedente meio para cima (longe do zero)
  let n = BigInt(inteiro + frac.padEnd(casas, '0').slice(0, casas));
  const resto = frac.slice(casas);
  if (resto && Number(resto[0]) >= 5) n += 1n;
  return sinal ? -n : n;
}

const paraCentavos = v => paraEscala(v, 2);
const paraPct4 = v => paraEscala(v, 4);          // 30 -> 300000n

// Divisão inteira com arredondamento meio para cima, longe do zero
// (ROUND_HALF_UP; para valores >= 0 é igual ao ROUND do Postgres).
function dividirArredondando(a, b) {
  const neg = (a < 0n) !== (b < 0n);
  const aa = a < 0n ? -a : a;
  const bb = b < 0n ? -b : b;
  let q = aa / bb;
  if ((aa % bb) * 2n >= bb) q += 1n;
  return neg ? -q : q;
}

// valor do Partner = ROUND(base × percentual / 100, 2), em centavos.
// base em centavos; percentual com 4 casas => divide por 100 × 10.000.
function valorPartnerCentavos(baseCentavos, pct4) {
  return dividirArredondando(baseCentavos * pct4, 1000000n);
}

function formatarCentavos(c) {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const s = abs.toString().padStart(3, '0');
  return `${neg ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`;
}

function formatarPct4(p) {
  const s = (p < 0n ? -p : p).toString().padStart(5, '0');
  return `${p < 0n ? '-' : ''}${s.slice(0, -4)}.${s.slice(-4)}`;
}

// Atalho com strings: calcularValorPartner('133.44', '30') -> '40.03'
function calcularValorPartner(base, percentual) {
  return formatarCentavos(valorPartnerCentavos(paraCentavos(base), paraPct4(percentual)));
}

module.exports = {
  paraCentavos, paraPct4, dividirArredondando, valorPartnerCentavos,
  formatarCentavos, formatarPct4, calcularValorPartner,
};

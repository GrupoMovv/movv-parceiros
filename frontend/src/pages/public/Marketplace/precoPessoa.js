import { useEffect, useState } from 'react';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';

// Preço que ESTA pessoa paga agora — mesma regra do servidor
// (backend/src/services/pedidoLoja.js): o MENOR preço a que ela tem direito,
// sem somar descontos. Preço de associado só com o benefício ATIVO; Fecha Mês
// (no dia do evento) e promoção valem pra todo mundo. O pedido pelo site
// sempre confere no servidor.

// "Essa pessoa é associada com benefício ativo?" pra cards e páginas — uma
// consulta só (/public/painel/me) pra tela inteira, refeita quando a pessoa
// entra ou sai (evento iub:sessao-associado-mudou).
let cache = { token: undefined, promessa: null };
function consultar() {
  const token = getPainelToken() || null;
  if (cache.token === token && cache.promessa) return cache.promessa;
  cache = {
    token,
    promessa: token
      ? apiPainel.get('/public/painel/me').then(r => Boolean(r.data?.eh_associado_ativo)).catch(() => false)
      : Promise.resolve(false),
  };
  return cache.promessa;
}

export function useEhAssociado() {
  const [eh, setEh] = useState(false);
  useEffect(() => {
    let vivo = true;
    const atualizar = () => consultar().then(v => { if (vivo) setEh(v); });
    atualizar();
    window.addEventListener('iub:sessao-associado-mudou', atualizar);
    return () => { vivo = false; window.removeEventListener('iub:sessao-associado-mudou', atualizar); };
  }, []);
  return eh;
}

const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

// Loja do Clube (b3): percentual da loja sobre o preço NORMAL, arredondado
// para baixo em centavos — a MESMA conta de backend/src/services/clubePreco.js.
export function precoComClube(normal, pct) {
  const centavos = Math.round(Number(normal) * 100);
  return Math.floor((centavos * (1000 - Math.round(Number(pct) * 10))) / 1000) / 100;
}

// Menor preço Clube de um item: o fixo ("Preço Clube" do produto ou da
// promoção) ou o percentual da loja (clube_pct, que a API já manda só quando
// vale para esse item), sobre o preço normal (base). null = sem preço Clube.
export function precoClubeDe(fixo, base, pct) {
  const c = [num(fixo), num(pct) !== null && num(base) !== null ? precoComClube(base, pct) : null].filter(v => v !== null && v > 0);
  return c.length ? Math.min(...c) : null;
}

// Produto do catálogo: { principal, riscado, tipo, chamadaAssociado, descontoPct }
//   principal         o que a pessoa paga agora
//   riscado           preço normal riscado (quando principal é menor)
//   tipo              'normal' | 'associado' | 'fecha_mes'
//   chamadaAssociado  preço de associado pra mostrar como CHAMADA a quem não
//                     é associado (gancho pra fazer a carteirinha), ou null
export function precoDoProduto(p, ehAssociado) {
  const normal = num(p.preco);
  const assoc = precoClubeDe(p.preco_associado, p.preco, p.clube_pct);
  const fm = num(p.preco_fecha_mes);
  const opcoes = [{ v: normal, tipo: 'normal' }];
  if (ehAssociado && assoc !== null && assoc > 0) opcoes.push({ v: assoc, tipo: 'associado' });
  if (fm !== null && fm > 0) opcoes.push({ v: fm, tipo: 'fecha_mes' });
  const escolhido = opcoes.reduce((m, o) => (o.v < m.v ? o : m));
  const riscado = escolhido.v < normal ? normal : null;
  return {
    principal: escolhido.v,
    riscado,
    tipo: escolhido.tipo,
    descontoPct: riscado ? Math.round((1 - escolhido.v / normal) * 100) : null,
    chamadaAssociado: !ehAssociado && assoc !== null && assoc < escolhido.v ? assoc : null,
  };
}

// Promoção: "por" pra todo mundo; o membro do Clube paga o menor entre "por" e o
// preço Clube (fixo da promoção ou percentual da loja sobre o "de").
export function precoDaPromocao(pm, ehAssociado) {
  const por = num(pm.preco_por);
  const assoc = precoClubeDe(pm.preco_associado, pm.preco_de, pm.clube_pct);
  const usaAssoc = ehAssociado && assoc !== null && assoc > 0 && assoc < por;
  return {
    principal: usaAssoc ? assoc : por,
    riscado: num(pm.preco_de),
    tipo: usaAssoc ? 'associado' : 'promocao',
    chamadaAssociado: !ehAssociado && assoc !== null && assoc < por ? assoc : null,
  };
}

// Disk Bebidas: preço vigente (oferta ou normal) pra todo mundo; o membro do
// Clube paga o menor entre ele e o percentual da loja sobre o preço normal.
export function precoDoBeer(b, ehAssociado) {
  const vigente = num(b.preco);
  const clube = precoClubeDe(null, b.preco_normal, b.clube_pct);
  const usaClube = ehAssociado && clube !== null && clube < vigente;
  return {
    principal: usaClube ? clube : vigente,
    riscado: usaClube ? num(b.preco_normal) : (b.em_oferta ? num(b.preco_original) : null),
    tipo: usaClube ? 'associado' : (b.em_oferta ? 'oferta' : 'normal'),
    chamadaAssociado: !ehAssociado && clube !== null && clube < vigente ? clube : null,
  };
}

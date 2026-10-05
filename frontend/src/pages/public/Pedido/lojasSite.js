import { useEffect, useState } from 'react';
import apiPainel from '../../../services/apiPainel';

// "Essa loja vende pelo site agora?" pra CARDS de listagem: junta as
// perguntas de todos os cards da tela numa chamada só
// (GET /public/pedidos/lojas) e guarda a resposta 1 minuto — uma vitrine
// com 30 cards não pode virar 30 chamadas.
// catalogo 'beer' = id do estabelecimento do Disk Bebidas; 'geral' = id da loja.

const CACHE_MS = 60 * 1000;
const cache = new Map(); // `${catalogo}:${id}` -> { ate, valor } | { promessa }
let fila = { beer: new Map(), geral: new Map() };
let agendado = null;

function disparar() {
  agendado = null;
  const atual = fila;
  fila = { beer: new Map(), geral: new Map() };
  const params = {};
  if (atual.beer.size) params.beer = [...atual.beer.keys()].join(',');
  if (atual.geral.size) params.geral = [...atual.geral.keys()].join(',');
  apiPainel.get('/public/pedidos/lojas', { params })
    .then(res => {
      for (const cat of ['beer', 'geral']) {
        for (const [id, resolver] of atual[cat]) {
          const valor = res.data?.[cat]?.[id] || { pode: false };
          cache.set(`${cat}:${id}`, { ate: Date.now() + CACHE_MS, valor });
          resolver(valor);
        }
      }
    })
    .catch(() => {
      for (const cat of ['beer', 'geral']) for (const [id, resolver] of atual[cat]) { cache.delete(`${cat}:${id}`); resolver({ pode: false }); }
    });
}

export function consultarLoja(catalogo, id) {
  const chave = `${catalogo}:${id}`;
  const c = cache.get(chave);
  if (c?.valor && c.ate > Date.now()) return Promise.resolve(c.valor);
  if (c?.promessa) return c.promessa;
  const promessa = new Promise(resolve => { fila[catalogo].set(String(id), resolve); });
  cache.set(chave, { promessa });
  if (!agendado) agendado = setTimeout(disparar, 30);
  return promessa;
}

// { pode, loja? } ou null enquanto pergunta
export function useLojaVendendo(catalogo, id) {
  const [valor, setValor] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let vivo = true;
    consultarLoja(catalogo, id).then(v => { if (vivo) setValor(v); });
    return () => { vivo = false; };
  }, [catalogo, id]);
  return valor;
}

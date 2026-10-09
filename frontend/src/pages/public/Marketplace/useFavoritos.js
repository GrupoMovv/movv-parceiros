import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';

const CHAVE_PADRAO = 'iub_marketplace_favoritos';
// Exportada porque mais de uma tela precisa da MESMA chave pra ler/escrever
// a mesma lista: ProdutoDetalhe.jsx marca o favorito, Marketplace.jsx (aba
// Favoritos) lê pra montar a vitrine — usar chaves diferentes nos dois
// lados foi o bug de "favorito não aparece na lista".
export const CHAVE_FAVORITOS_PRODUTOS = 'iub_mais_produtos_favoritos';

function lerFavoritos(chave) {
  try {
    const raw = localStorage.getItem(chave);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// chave customizada permite reusar o mesmo hook pra listas diferentes
// (parceiros favoritos vs produtos favoritos), cada uma com seu storage.
export function useFavoritos(chave = CHAVE_PADRAO) {
  const [favoritos, setFavoritos] = useState(() => lerFavoritos(chave));

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(favoritos));
    } catch {
      // localStorage indisponível (modo privado, etc.) — favoritos ficam só na sessão
    }
  }, [chave, favoritos]);

  const alternar = useCallback((id) => {
    setFavoritos((atual) => (
      atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]
    ));
  }, []);

  const ehFavorito = useCallback((id) => favoritos.includes(id), [favoritos]);

  return { favoritos, alternar, ehFavorito };
}

// Número do coração (TopNav e menu de baixo): conta só o que aparece na
// página /favoritos. A lista fica no celular da pessoa e pode guardar loja
// pausada, produto apagado ou os convênios antigos da lista escrita no
// código; o servidor responde 404 para esses e eles saem da conta (a lista
// guardada não muda: se a loja voltar, o favorito volta junto).
const ROTA_FAVORITO = {
  [CHAVE_PADRAO]: id => `/public/lojas/${encodeURIComponent(id)}`,
  [CHAVE_FAVORITOS_PRODUTOS]: id => `/public/produtos/${encodeURIComponent(id)}`,
};
const conferidos = new Set();   // `${chave}:${id}` já perguntados nesta sessão
const inexistentes = new Set(); // os que responderam 404
const ouvintes = new Set();

function conferir(chave, ids) {
  for (const id of ids) {
    const k = `${chave}:${id}`;
    if (conferidos.has(k)) continue;
    conferidos.add(k);
    api.get(ROTA_FAVORITO[chave](id)).catch(err => {
      if (err?.response?.status !== 404) { conferidos.delete(k); return; }
      inexistentes.add(k);
      ouvintes.forEach(f => f());
    });
  }
}

export function useQtdFavoritos() {
  const { favoritos: lojas } = useFavoritos();
  const { favoritos: produtos } = useFavoritos(CHAVE_FAVORITOS_PRODUTOS);
  const [, setVersao] = useState(0);
  useEffect(() => {
    const avisar = () => setVersao(v => v + 1);
    ouvintes.add(avisar);
    return () => { ouvintes.delete(avisar); };
  }, []);
  const chaveLojas = lojas.join('|');
  const chaveProdutos = produtos.join('|');
  useEffect(() => { conferir(CHAVE_PADRAO, lojas); }, [chaveLojas]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { conferir(CHAVE_FAVORITOS_PRODUTOS, produtos); }, [chaveProdutos]); // eslint-disable-line react-hooks/exhaustive-deps
  const visiveis = (chave, ids) => ids.filter(id => !inexistentes.has(`${chave}:${id}`)).length;
  return visiveis(CHAVE_PADRAO, lojas) + visiveis(CHAVE_FAVORITOS_PRODUTOS, produtos);
}

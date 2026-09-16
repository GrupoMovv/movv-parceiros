import { useCallback, useEffect, useState } from 'react';

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

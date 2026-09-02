import { useCallback, useEffect, useState } from 'react';

const CHAVE = 'iub_marketplace_favoritos';

function lerFavoritos() {
  try {
    const raw = localStorage.getItem(CHAVE);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState(lerFavoritos);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(favoritos));
    } catch {
      // localStorage indisponível (modo privado, etc.) — favoritos ficam só na sessão
    }
  }, [favoritos]);

  const alternar = useCallback((slug) => {
    setFavoritos((atual) => (
      atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]
    ));
  }, []);

  const ehFavorito = useCallback((slug) => favoritos.includes(slug), [favoritos]);

  return { favoritos, alternar, ehFavorito };
}

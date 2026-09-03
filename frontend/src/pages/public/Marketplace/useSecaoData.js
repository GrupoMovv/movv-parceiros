import { useEffect, useState } from 'react';
import api from '../../../services/api';

// Cada seção de produto da home busca seu próprio endpoint, em paralelo e
// independente das outras — uma seção lenta ou vazia nunca bloqueia o
// resto da página (Bloco 8: "não bloquear render inicial").
export function useProdutosSecao(endpoint) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api.get(endpoint)
      .then(res => { if (ativo) setProdutos(res.data.produtos); })
      .catch(() => { if (ativo) setProdutos([]); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [endpoint]);

  return { produtos, carregando };
}

export function useCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/public/marketplace/categorias')
      .then(res => setCategorias(res.data.categorias))
      .catch(() => setCategorias([]))
      .finally(() => setCarregando(false));
  }, []);

  return { categorias, carregando };
}

export function useParceirosCompactos() {
  const [parceiros, setParceiros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/public/marketplace/parceiros')
      .then(res => setParceiros(res.data.parceiros))
      .catch(() => setParceiros([]))
      .finally(() => setCarregando(false));
  }, []);

  return { parceiros, carregando };
}

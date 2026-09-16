import { useEffect, useState } from 'react';
import api from '../../../services/api';

// Cada seção de produto da home busca seu próprio endpoint, em paralelo e
// independente das outras — uma seção lenta ou vazia nunca bloqueia o
// resto da página (Bloco 8: "não bloquear render inicial").
export function useProdutosSecao(endpoint, chave = 'produtos') {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api.get(endpoint)
      .then(res => { if (ativo) setProdutos(res.data[chave]); })
      .catch(() => { if (ativo) setProdutos([]); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [endpoint, chave]);

  return { produtos, carregando };
}

// Não existe endpoint de "buscar produtos por lista de ids" — busca cada um
// em paralelo pelo GET /public/produtos/:id (mesmo endpoint do
// ProdutoDetalhe). Ids de produto que sumiram (excluído/pausado) só somem
// da lista silenciosamente (404 é esperado, não é erro pra logar).
export function useProdutosPorIds(ids) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const chaveIds = ids.join(',');

  useEffect(() => {
    let ativo = true;
    if (!ids.length) {
      setProdutos([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    Promise.all(ids.map(id => api.get(`/public/produtos/${id}`).then(res => res.data).catch(() => null)))
      .then(resultados => { if (ativo) setProdutos(resultados.filter(Boolean)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveIds]);

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

// Só Premium/Master (+ seed de demonstração) — vitrine "Parceiros em
// Destaque" no topo da home, ver getParceirosDestaques no backend.
export function useParceirosDestaques() {
  const [parceiros, setParceiros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/public/marketplace/parceiros-destaques')
      .then(res => setParceiros(res.data.parceiros))
      .catch(() => setParceiros([]))
      .finally(() => setCarregando(false));
  }, []);

  return { parceiros, carregando };
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';

const CHAVE_LS = 'iub_marketplace_carrinho';
const EXPIRA_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function lerLocal() {
  try {
    const raw = localStorage.getItem(CHAVE_LS);
    if (!raw) return [];
    const { itens, salvoEm } = JSON.parse(raw);
    if (!Array.isArray(itens) || Date.now() - salvoEm > EXPIRA_MS) return [];
    return itens;
  } catch {
    return [];
  }
}

function salvarLocal(itens) {
  try {
    localStorage.setItem(CHAVE_LS, JSON.stringify({ itens, salvoEm: Date.now() }));
  } catch {
    // localStorage indisponível (modo privado etc.) — carrinho fica só na sessão
  }
}

const CarrinhoContext = createContext(null);

// Lista de interesses do marketplace (não é carrinho de compra — não
// processa pagamento). Visitante sem sessão guarda só os IDs no
// localStorage; associado logado persiste no banco. As duas fontes
// convergem no mesmo endpoint de "montar grupos" do backend, que sempre
// busca nome/preço atualizados — o front nunca guarda esses dados por
// conta própria, só o produto_id.
export function CarrinhoProvider({ children }) {
  const [grupos, setGrupos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pulsar, setPulsar] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const token = getPainelToken();
      if (token) {
        const locais = lerLocal();
        if (locais.length > 0) {
          try {
            await apiPainel.post('/public/carrinho/migrar', { produto_ids: locais.map(i => i.produto_id) });
            salvarLocal([]);
          } catch {
            // se a migração falhar tenta de novo na próxima carga — não perde o carrinho local
          }
        }
        const res = await apiPainel.get('/public/carrinho');
        setGrupos(res.data.grupos);
      } else {
        const locais = lerLocal();
        if (locais.length === 0) { setGrupos([]); return; }
        const res = await apiPainel.post('/public/carrinho/detalhar', { produto_ids: locais.map(i => i.produto_id) });
        setGrupos(res.data.grupos);
        if (res.data.produtos_invalidos?.length > 0) {
          salvarLocal(locais.filter(i => !res.data.produtos_invalidos.includes(i.produto_id)));
        }
      }
    } catch {
      setGrupos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    window.addEventListener('iub:sessao-associado-mudou', carregar);
    return () => window.removeEventListener('iub:sessao-associado-mudou', carregar);
  }, [carregar]);

  function dispararPulso() {
    setPulsar(true);
    setTimeout(() => setPulsar(false), 700);
  }

  const estaNoCarrinho = useCallback((produtoId) => {
    return grupos.some(g => g.produtos.some(p => p.id === produtoId));
  }, [grupos]);

  async function adicionar(produtoId) {
    if (estaNoCarrinho(produtoId)) return;
    try {
      if (getPainelToken()) {
        await apiPainel.post('/public/carrinho/adicionar', { produto_id: produtoId });
      } else {
        const locais = lerLocal();
        salvarLocal([...locais, { produto_id: produtoId, adicionado_em: new Date().toISOString() }]);
      }
      dispararPulso();
      toast.success('Produto adicionado ao carrinho!');
      await carregar();
    } catch {
      toast.error('Erro ao adicionar ao carrinho');
    }
  }

  async function remover(produtoId, { silencioso = false } = {}) {
    try {
      if (getPainelToken()) {
        await apiPainel.delete(`/public/carrinho/remover/${produtoId}`);
      } else {
        salvarLocal(lerLocal().filter(i => i.produto_id !== produtoId));
      }
      if (!silencioso) toast.success('Removido do carrinho');
      await carregar();
    } catch {
      toast.error('Erro ao remover do carrinho');
    }
  }

  async function limpar() {
    try {
      if (getPainelToken()) await apiPainel.post('/public/carrinho/limpar');
      else salvarLocal([]);
      await carregar();
    } catch {
      toast.error('Erro ao limpar carrinho');
    }
  }

  const totalItens = useMemo(() => grupos.reduce((n, g) => n + g.produtos.length, 0), [grupos]);

  const valor = useMemo(() => ({
    grupos, totalItens, carregando, pulsar, adicionar, remover, limpar, estaNoCarrinho, recarregar: carregar,
  }), [grupos, totalItens, carregando, pulsar, estaNoCarrinho, carregar]);

  return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error('useCarrinho precisa estar dentro de <CarrinhoProvider>');
  return ctx;
}

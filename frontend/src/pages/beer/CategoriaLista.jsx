import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal, Storefront } from '@phosphor-icons/react';
import api from '../../services/api';
import CardProduto from '../../components/beer/CardProduto';
import CardAdegaAberta from '../../components/beer/CardAdegaAberta';
import FiltrosAvancados from '../../components/beer/FiltrosAvancados';
import { BEER, ORDENACOES } from './beerConfig';

// Parâmetros da URL que são FILTRO (o ?p= do modal de produto não conta —
// abrir um produto não pode recarregar a lista).
const CHAVES_FILTRO = ['sub', 'abertos', 'preco_min', 'preco_max', 'est', 'vol', 'origem', 'ordem'];
const LISTAS = ['est', 'vol', 'origem'];

function lerFiltros(params) {
  const f = {};
  CHAVES_FILTRO.forEach(k => {
    const v = params.get(k);
    if (v === null || v === '') return;
    f[k] = LISTAS.includes(k) ? v.split(',').filter(Boolean) : v;
  });
  return f;
}

// /beer/categoria/:codigo — tela híbrida: 🔥 Ofertas do dia, 🏪 Adegas
// abertas agora, ⭐ Destaques e 📋 Todos os produtos (20 por vez, carrega
// mais ao rolar). Tudo vem de GET /public/beer/categoria/:codigo; filtros,
// ordenação e "apenas abertos" moram na URL (link compartilhável) e trocam
// a lista sem recarregar a página.
export default function CategoriaLista() {
  const { codigo } = useParams();
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const chaveFiltros = JSON.stringify(filtros);

  // Resposta da página 1 (seções + facetas) + `abertos` DAQUELA consulta: o
  // contador não pode dizer "agora" com o número da lista anterior.
  const [dados, setDados] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const consulta = useCallback(pag => {
    const q = { pagina: pag };
    Object.entries(JSON.parse(chaveFiltros)).forEach(([k, v]) => { q[k] = Array.isArray(v) ? v.join(',') : v; });
    return api.get(`/public/beer/categoria/${codigo}`, { params: q });
  }, [codigo, chaveFiltros]);

  // Filtro mudou = volta pra página 1. Mantém o que já está na tela
  // enquanto carrega (opacidade), sem piscar a página inteira.
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(false);
    const t = setTimeout(() => {
      consulta(1)
        .then(res => { if (!vivo) return; setDados({ ...res.data, abertos: JSON.parse(chaveFiltros).abertos === 'true' }); setProdutos(res.data.produtos); setPagina(1); setTemMais(res.data.tem_mais); })
        .catch(err => { if (vivo) setErro(err.response?.status === 404 ? 'nao_existe' : true); })
        .finally(() => { if (vivo) setCarregando(false); });
    }, 150);
    return () => { vivo = false; clearTimeout(t); };
  }, [consulta, tentativa]);

  const carregarMais = useCallback(() => {
    if (carregandoMais || !temMais) return;
    setCarregandoMais(true);
    consulta(pagina + 1)
      .then(res => { setProdutos(lista => [...lista, ...res.data.produtos]); setPagina(pagina + 1); setTemMais(res.data.tem_mais); })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }, [consulta, pagina, temMais, carregandoMais]);

  // rolagem infinita: sentinela no fim da grade
  const sentinela = useRef(null);
  useEffect(() => {
    if (!sentinela.current || !temMais) return undefined;
    const obs = new IntersectionObserver(entradas => { if (entradas[0].isIntersecting) carregarMais(); }, { rootMargin: '400px' });
    obs.observe(sentinela.current);
    return () => obs.disconnect();
  }, [temMais, carregarMais]);

  function mudarFiltros(novos, { substituir = false } = {}) {
    setParams(prev => {
      const n = new URLSearchParams(prev);
      (substituir ? CHAVES_FILTRO : Object.keys(novos)).forEach(k => n.delete(k));
      Object.entries(novos).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) n.delete(k);
        else n.set(k, Array.isArray(v) ? v.join(',') : String(v));
      });
      n.delete('p');
      return n;
    }, { replace: true });
  }

  if (erro === 'nao_existe') {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-10">
        <Caixa titulo="Categoria não encontrada" acao={<Link to="/beer/categorias" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white inline-block" style={{ backgroundColor: BEER.violeta }}>Ver todas as categorias</Link>} />
      </main>
    );
  }

  const cat = dados?.categoria;
  const apenasAbertos = filtros.abertos === 'true';
  const qtdAvancados = ['preco_min', 'preco_max'].some(k => filtros[k]) + LISTAS.reduce((s, k) => s + (filtros[k]?.length || 0), 0);
  const algumFiltro = apenasAbertos || qtdAvancados > 0 || filtros.sub;
  const secoes = dados?.secoes;
  const voltar = cat && !cat.eh_grupo ? `/beer/categoria/${dados.grupo.codigo}` : '/beer';

  return (
    <>
      <header style={{ background: `radial-gradient(120% 160% at 90% 0%, ${BEER.violeta} 0%, ${BEER.roxo} 40%, ${BEER.painel} 85%)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-5 sm:py-8">
          <Link to={voltar} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: BEER.lavanda }}>
            <ArrowLeft size={14} weight="bold" /> {cat && !cat.eh_grupo ? dados.grupo.nome : 'Disk Bebidas'}
          </Link>
          <h1 className="mt-1 text-2xl sm:text-4xl font-black text-white tracking-tight uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {cat ? `${cat.icone} ${cat.nome}` : '…'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }} aria-live="polite">
            {dados ? `${dados.total} ${dados.total === 1 ? 'produto disponível' : 'produtos disponíveis'}${dados.abertos ? ' agora' : ''}` : ' '}
          </p>
        </div>
      </header>

      {/* Barra de filtros rápidos — gruda no topo ao rolar */}
      <div className="sticky top-0 z-20 backdrop-blur-md" style={{ backgroundColor: 'rgba(18,9,31,0.92)', borderBottom: `1px solid ${BEER.borda}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-3 space-y-2.5">
          {cat?.eh_grupo && dados.subcategorias.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              <Chip ativo={!filtros.sub} onClick={() => mudarFiltros({ sub: null })}>Todos</Chip>
              {dados.subcategorias.map(s => (
                <Chip key={s.codigo} ativo={filtros.sub === s.codigo} onClick={() => mudarFiltros({ sub: s.codigo })} vazio={s.total === 0}>
                  {s.nome}{s.total > 0 && <span className="opacity-60"> {s.total}</span>}
                </Chip>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => mudarFiltros({ abertos: apenasAbertos ? null : 'true' })}
              aria-pressed={apenasAbertos}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-full transition-colors"
              style={apenasAbertos
                ? { backgroundColor: '#16A34A', color: '#fff', border: '1px solid #16A34A' }
                : { color: '#86EFAC', border: '1px solid rgba(134,239,172,0.4)', backgroundColor: 'rgba(34,197,94,0.08)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: apenasAbertos ? '#fff' : '#22C55E' }} />
              Apenas abertos agora
            </button>
            <button
              type="button"
              onClick={() => setPainelAberto(true)}
              disabled={!dados}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-full"
              style={{ color: '#fff', border: `1px solid ${qtdAvancados ? BEER.violeta : BEER.borda}`, backgroundColor: qtdAvancados ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.04)' }}
            >
              <SlidersHorizontal size={15} weight="bold" /> 🎯 Filtros{qtdAvancados > 0 && ` (${qtdAvancados})`}
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-xs" style={{ color: BEER.lavandaFraca }}>
              <span className="hidden sm:inline">Ordenar por</span>
              <select
                value={filtros.ordem || 'relevancia'}
                onChange={e => mudarFiltros({ ordem: e.target.value === 'relevancia' ? null : e.target.value })}
                className="text-xs sm:text-sm font-semibold rounded-full px-3 py-2 outline-none"
                style={{ backgroundColor: BEER.painel, color: '#fff', border: `1px solid ${BEER.borda}` }}
                aria-label="Ordenar por"
              >
                {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <main className={`max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8 space-y-9 transition-opacity ${carregando && dados ? 'opacity-60' : ''}`}>
        {cat?.regulamentada && (
          <p className="text-xs rounded-xl px-4 py-3" style={{ color: '#FCA5A5', backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
            Categoria regulamentada. Venda proibida para menores de 18 anos — o estabelecimento confere documento na entrega.
          </p>
        )}

        {erro === true ? (
          <Caixa titulo="Não foi possível carregar agora." acao={<button type="button" onClick={() => setTentativa(t => t + 1)} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: BEER.violeta }}>Tentar de novo</button>} />
        ) : !dados ? (
          <Esqueleto />
        ) : dados.total === 0 ? (
          algumFiltro ? (
            <Caixa emoji="🔎" titulo="Nada com esses filtros" texto={apenasAbertos ? 'Ninguém com essa categoria está aberto agora.' : 'Tente tirar algum filtro.'}
              acao={<button type="button" onClick={() => mudarFiltros({}, { substituir: true })} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: BEER.violeta }}>Limpar filtros</button>} />
          ) : (
            <VazioCategoria nome={cat.nome} icone={cat.icone} />
          )
        ) : (
          <>
            {secoes?.ofertas.length > 0 && (
              <Secao titulo="🔥 Ofertas do dia" destaque>
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
                  {secoes.ofertas.map(p => <CardProduto key={`o${p.id}`} produto={p} variante="oferta" className="flex-shrink-0 w-[46%] sm:w-auto snap-start" />)}
                </div>
              </Secao>
            )}

            {secoes?.adegas_abertas.length > 0 && (
              <Secao titulo="🏪 Adegas abertas agora">
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
                  {secoes.adegas_abertas.map(e => <CardAdegaAberta key={e.id} estabelecimento={e} nomeCategoria={cat.nome} />)}
                </div>
              </Secao>
            )}

            {secoes?.destaques.length > 0 && (
              <Secao titulo="⭐ Produtos em destaque">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {secoes.destaques.map(p => <CardProduto key={`d${p.id}`} produto={p} variante="destaque" />)}
                </div>
              </Secao>
            )}

            <Secao titulo="📋 Todos os produtos">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {produtos.map(p => <CardProduto key={p.id} produto={p} />)}
              </div>
              {temMais && (
                <div ref={sentinela} className="flex justify-center pt-5">
                  <button type="button" onClick={carregarMais} disabled={carregandoMais} className="text-sm font-bold px-6 py-3 rounded-xl" style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}>
                    {carregandoMais ? 'Carregando…' : 'Carregar mais'}
                  </button>
                </div>
              )}
            </Secao>
          </>
        )}
      </main>

      {painelAberto && dados && (
        <FiltrosAvancados
          facetas={dados.facetas}
          valores={{
            preco_min: filtros.preco_min ? Number(filtros.preco_min) : null,
            preco_max: filtros.preco_max ? Number(filtros.preco_max) : null,
            est: filtros.est || [], vol: filtros.vol || [], origem: filtros.origem || [],
          }}
          onFechar={() => setPainelAberto(false)}
          onAplicar={v => {
            mudarFiltros({ preco_min: v.preco_min ?? null, preco_max: v.preco_max ?? null, est: v.est || null, vol: v.vol || null, origem: v.origem || null });
            setPainelAberto(false);
          }}
        />
      )}
    </>
  );
}

function Chip({ ativo, onClick, vazio = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className="flex-shrink-0 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap transition-colors"
      style={ativo
        ? { backgroundColor: BEER.violeta, color: '#fff', border: `1px solid ${BEER.violeta}` }
        : { color: vazio ? BEER.lavandaFraca : BEER.lavanda, border: `1px solid ${BEER.borda}`, backgroundColor: 'rgba(255,255,255,0.04)' }}
    >
      {children}
    </button>
  );
}

function Secao({ titulo, destaque = false, children }) {
  return (
    <section>
      <h2 className={`mb-3 font-black text-white ${destaque ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />)}
    </div>
  );
}

function Caixa({ emoji, titulo, texto, acao }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-14 px-4 rounded-3xl" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
      {emoji && <div className="text-5xl" aria-hidden="true">{emoji}</div>}
      <p className="text-lg font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{titulo}</p>
      {texto && <p className="text-sm max-w-md" style={{ color: BEER.lavanda }}>{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

// Estado vazio de verdade (categoria sem nenhum produto, sem filtro).
function VazioCategoria({ nome, icone }) {
  return (
    <div className="rounded-3xl px-5 py-10 sm:py-14 text-center" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
      <div className="text-5xl" aria-hidden="true">🥺</div>
      <p className="mt-3 text-lg sm:text-xl font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Nenhum produto em {icone} {nome} ainda
      </p>
      <p className="mt-2 text-sm" style={{ color: BEER.lavanda }}>As primeiras adegas de Itumbiara estão chegando!</p>
      <div className="mt-6 mx-auto max-w-sm rounded-2xl p-5 text-left" style={{ backgroundColor: BEER.card, border: `1px solid ${BEER.borda}` }}>
        <p className="text-sm font-bold text-white flex items-center gap-2"><Storefront size={18} color={BEER.dourado} weight="fill" /> Você tem uma adega?</p>
        <p className="mt-1 text-xs" style={{ color: BEER.lavanda }}>Cadastre-se como parceiro e apareça pra quem procura {nome.toLowerCase()} em Itumbiara.</p>
        <Link to="/vender" className="mt-4 inline-flex justify-center w-full text-sm font-black py-3 rounded-xl" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>Ver planos</Link>
      </div>
    </div>
  );
}

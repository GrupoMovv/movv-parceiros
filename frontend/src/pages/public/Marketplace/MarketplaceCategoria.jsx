import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, ImageOff, X } from 'lucide-react';
import { Diamond } from '@phosphor-icons/react';
import api, { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import CardProduto from './components/CardProduto';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useFavoritos } from './useFavoritos';
import { useAssociadoSessao } from './useAssociadoSessao';
import { PRETO, ROXO } from './theme';

const ORDENACOES = [
  { valor: 'relevancia', label: 'Relevância' },
  { valor: 'menor_preco', label: 'Menor preço' },
  { valor: 'maior_preco', label: 'Maior preço' },
  { valor: 'recente', label: 'Mais recente' },
];

const FILTROS_VAZIOS = { bairro: '', preco_min: '', preco_max: '', ordenar: 'relevancia', somente_associado: false, somente_desconto: false, subcategoria: '' };

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="h-[140px] sm:h-[180px] rounded-md bg-slate-100" />
      <div className="h-2.5 bg-slate-100 rounded-full mt-2 w-1/2" />
      <div className="h-3.5 bg-slate-100 rounded-full mt-1.5 w-5/6" />
      <div className="h-4 bg-slate-100 rounded-full mt-1.5 w-2/3" />
    </div>
  );
}

export default function MarketplaceCategoria() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { favoritos } = useFavoritos();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtrosMobileAbertos, setFiltrosMobileAbertos] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(false);
    api.get(`/public/marketplace/categoria/${slug}/produtos`, {
      params: {
        pagina,
        bairro: filtros.bairro || undefined,
        preco_min: filtros.preco_min || undefined,
        preco_max: filtros.preco_max || undefined,
        ordenar: filtros.ordenar !== 'relevancia' ? filtros.ordenar : undefined,
        somente_associado: filtros.somente_associado || undefined,
        somente_desconto: filtros.somente_desconto || undefined,
        subcategoria: filtros.subcategoria || undefined,
      },
    })
      .then(res => setDados(res.data))
      .catch(err => { if (err.response?.status !== 404) setErro(true); else setDados({ notFound: true }); })
      .finally(() => setCarregando(false));
  }, [slug, pagina, filtros]);

  useEffect(() => { setPagina(1); }, [slug, filtros]);
  useEffect(() => { carregar(); window.scrollTo({ top: 0, behavior: 'instant' }); }, [carregar]);

  function atualizarFiltro(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: valor }));
  }

  if (dados?.notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-bold text-lg" style={{ color: PRETO }}>Categoria não encontrada</p>
        <button onClick={() => navigate('/marketplace')} className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
          Voltar pro Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carregandoAssociado={carregandoAssociado}
        favoritosAtivos={false}
        onToggleFavoritos={() => navigate('/marketplace')}
        qtdFavoritos={favoritos.length}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => navigate('/marketplace')}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 flex-1 flex gap-6">
        <FiltrosSidebar
          filtros={filtros} atualizarFiltro={atualizarFiltro}
          subcategorias={dados?.subcategorias || []} bairros={dados?.bairros || []}
          className="hidden lg:block w-56 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: PRETO }}>
                {dados?.categoria?.label || '...'}
              </h1>
              {!carregando && <p className="text-slate-400 text-xs mt-0.5">{dados?.total || 0} produto{dados?.total === 1 ? '' : 's'}</p>}
            </div>
            <button
              onClick={() => setFiltrosMobileAbertos(true)}
              className="lg:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
            </button>
          </div>

          {erro ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <p className="text-slate-500 text-sm">Não foi possível carregar os produtos agora.</p>
              <button onClick={carregar} className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Tentar de novo</button>
            </div>
          ) : carregando ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : dados.produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <ImageOff className="w-8 h-8 text-slate-300" />
              <p className="text-slate-500 text-sm">Nenhum produto encontrado com esses filtros.</p>
              <button onClick={() => setFiltros(FILTROS_VAZIOS)} className="text-xs font-semibold underline" style={{ color: ROXO }}>Limpar filtros</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {dados.produtos.map(p => <CardProduto key={p.id} produto={p} />)}
              </div>

              {dados.total_paginas > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-500 px-2">Página {pagina} de {dados.total_paginas}</span>
                  <button
                    onClick={() => setPagina(p => Math.min(dados.total_paginas, p + 1))} disabled={pagina >= dados.total_paginas}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filtrosMobileAbertos && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltrosMobileAbertos(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
              <p className="font-bold text-sm" style={{ color: PRETO }}>Filtros</p>
              <button onClick={() => setFiltrosMobileAbertos(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <FiltrosSidebar
              filtros={filtros} atualizarFiltro={atualizarFiltro}
              subcategorias={dados?.subcategorias || []} bairros={dados?.bairros || []}
              className="p-4"
            />
          </div>
        </div>
      )}

      <Footer />

      <MobileBottomNav
        favoritosAtivos={false}
        onToggleFavoritos={() => navigate('/marketplace')}
        nomeAssociado={nomeAssociado}
        onLoginSuccess={recarregar}
      />
    </div>
  );
}

function FiltrosSidebar({ filtros, atualizarFiltro, subcategorias, bairros, className = '' }) {
  return (
    <aside className={className}>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Ordenar por</p>
          <select className="input w-full text-sm" value={filtros.ordenar} onChange={e => atualizarFiltro('ordenar', e.target.value)}>
            {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Preço</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" placeholder="Mín." value={filtros.preco_min} onChange={e => atualizarFiltro('preco_min', e.target.value)} className="input w-full text-sm" />
            <span className="text-slate-300">—</span>
            <input type="number" min="0" placeholder="Máx." value={filtros.preco_max} onChange={e => atualizarFiltro('preco_max', e.target.value)} className="input w-full text-sm" />
          </div>
        </div>

        {bairros.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Bairro</p>
            <select className="input w-full text-sm" value={filtros.bairro} onChange={e => atualizarFiltro('bairro', e.target.value)}>
              <option value="">Todos os bairros</option>
              {bairros.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {subcategorias.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Subcategoria</p>
            <select className="input w-full text-sm" value={filtros.subcategoria} onChange={e => atualizarFiltro('subcategoria', e.target.value)}>
              <option value="">Todas</option>
              {subcategorias.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={filtros.somente_associado} onChange={e => atualizarFiltro('somente_associado', e.target.checked)} className="w-4 h-4" style={{ accentColor: ROXO }} />
            <span className="text-sm text-slate-700 flex items-center gap-1"><Diamond size={12} weight="duotone" color={ROXO} /> Só com preço associado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={filtros.somente_desconto} onChange={e => atualizarFiltro('somente_desconto', e.target.checked)} className="w-4 h-4" style={{ accentColor: ROXO }} />
            <span className="text-sm text-slate-700">Só com desconto</span>
          </label>
        </div>
      </div>
    </aside>
  );
}

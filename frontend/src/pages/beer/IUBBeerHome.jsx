import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Storefront } from '@phosphor-icons/react';
import api, { assetUrl } from '../../services/api';
import TopNav from '../public/Marketplace/components/TopNav';
import Footer from '../public/Marketplace/components/Footer';
import MobileBottomNav from '../public/Marketplace/components/MobileBottomNav';
import { useAssociadoSessao } from '../public/Marketplace/useAssociadoSessao';
import ModalMaiorIdade from '../../components/beer/ModalMaiorIdade';
import FiltroCategorias from '../../components/beer/FiltroCategorias';
import CardEstabelecimento from '../../components/beer/CardEstabelecimento';
import { useAcessoBeer } from './useAcessoBeer';
import { BEER, ROXINHO_GENTLEMAN_URL, TIPOS_ESTABELECIMENTO, labelCategoria } from './beerConfig';

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Grupo de cada plano na lista — a ORDEM já vem do backend (Master >
// Premium > Oficial > Grátis); aqui só decide a grade de cada faixa, porque
// cada plano tem um tamanho de card (ver CardEstabelecimento).
const GRADE_POR_PLANO = {
  master: 'grid grid-cols-1 lg:grid-cols-2 gap-5',
  premium: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  oficial: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3',
  gratis: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
};

// Home do IUB BEER (/beer) — adegas, bares, distribuidoras. Mesmo modelo do
// IUB Food: estabelecimento = parceiro com "Bebidas" nas categorias (ver
// backend beerController). Nada da área aparece antes da porta +18
// (useAcessoBeer) — nem a lista é buscada.
export default function IUBBeerHome() {
  const navigate = useNavigate();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const { estado, confirmar } = useAcessoBeer();

  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (estado !== 'liberado') return;
    setCarregando(true);
    setErro(false);
    api.get('/public/beer/estabelecimentos', { params: categoria ? { categoria } : {} })
      .then(res => setEstabelecimentos(res.data.estabelecimentos))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [estado, categoria, tentativa]);

  // Busca no que o card mostra (nome, tipo, bairros, bebidas do cardápio).
  // Busca por PRODUTO específico ("heineken") entra com o cardápio (fase B).
  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return estabelecimentos;
    return estabelecimentos.filter(e => normalizar([
      e.nome, TIPOS_ESTABELECIMENTO[e.beer_tipo], e.categoria_principal, e.bairro, ...(e.bairros_entrega || []),
      ...(e.categorias_bebida || []).map(c => labelCategoria(c)?.label),
    ].filter(Boolean).join(' ')).includes(termo));
  }, [estabelecimentos, busca]);

  const grupos = ['master', 'premium', 'oficial', 'gratis']
    .map(plano => ({ plano, itens: filtrados.filter(e => (GRADE_POR_PLANO[e.plano] ? e.plano : 'gratis') === plano) }))
    .filter(g => g.itens.length > 0);

  return (
    <div className="min-h-screen w-full flex flex-col pb-14 sm:pb-0" style={{ backgroundColor: BEER.fundo }}>
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={() => navigate('/marketplace')}
      />

      {estado === 'modal' && <ModalMaiorIdade onConfirmar={confirmar} onCancelar={() => navigate('/marketplace')} />}

      {estado === 'bloqueado' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
          <div className="text-5xl" aria-hidden="true">🔞</div>
          <h1 className="mt-4 text-xl sm:text-2xl font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Área exclusiva para maiores de 18 anos</h1>
          <p className="mt-2 text-sm max-w-sm" style={{ color: BEER.lavanda }}>Pela data de nascimento do seu cadastro, o IUB BEER ainda não está liberado pra você.</p>
          <Link to="/marketplace" className="mt-6 text-sm font-bold px-6 py-3 rounded-2xl text-white" style={{ backgroundColor: BEER.violeta }}>Voltar pro marketplace</Link>
        </div>
      )}

      {(estado === 'verificando' || estado === 'modal') && <div className="flex-1 min-h-[60vh]" />}

      {estado === 'liberado' && (
        <>
          <header className="relative overflow-hidden" style={{ background: `radial-gradient(120% 140% at 85% 0%, ${BEER.violeta} 0%, ${BEER.roxo} 38%, ${BEER.painel} 78%, ${BEER.fundo} 100%)` }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 sm:py-12 flex items-center gap-5 sm:gap-10">
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.5px] sm:tracking-[2px] px-3 py-1 rounded-full whitespace-nowrap" style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}`, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  🔞 +18 · Beba com responsabilidade
                </span>
                <h1 className="mt-3 text-4xl sm:text-6xl font-black text-white tracking-tight leading-none" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  IUB <span style={{ color: BEER.lavanda }}>BEER</span>
                </h1>
                <div className="mt-3 h-px w-16" style={{ backgroundColor: BEER.dourado, opacity: 0.7 }} />
                <p className="mt-3 text-sm sm:text-lg max-w-md" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Adegas, bares e distribuidoras de Itumbiara. Peça direto no WhatsApp.
                </p>
              </div>
              <img
                src={ROXINHO_GENTLEMAN_URL}
                alt="Roxinho Gentleman, de bigode e gravata-borboleta"
                className="w-24 h-24 sm:w-44 sm:h-44 rounded-full object-cover flex-shrink-0"
                style={{ boxShadow: `0 0 0 3px ${BEER.borda}, 0 20px 50px rgba(0,0,0,0.55)` }}
              />
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-6 sm:py-8 flex-1">
            <label className="flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
              <MagnifyingGlass size={18} color={BEER.lavanda} />
              <input
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar adega, bar, bairro ou bebida…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-violet-300/50"
              />
            </label>

            <div className="mt-4">
              <FiltroCategorias ativa={categoria} onSelecionar={setCategoria} />
            </div>

            <p className="mt-5 mb-4 text-xs" style={{ color: 'rgba(196,181,253,0.6)' }}>
              {!carregando && !erro && `${filtrados.length} estabelecimento${filtrados.length === 1 ? '' : 's'}`}
            </p>

            {erro ? (
              <EstadoVazio titulo="Não foi possível carregar agora." acao={<button type="button" onClick={() => setTentativa(t => t + 1)} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: BEER.violeta }}>Tentar de novo</button>} />
            ) : carregando ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />)}
              </div>
            ) : grupos.length === 0 ? (
              estabelecimentos.length === 0 && !categoria ? (
                <EstadoVazio
                  emoji="🥃"
                  titulo="As primeiras adegas de Itumbiara estão chegando"
                  texto="Em breve você pede cerveja, vinho, whisky e gelo aqui, direto no WhatsApp do estabelecimento."
                  acao={(
                    <Link to="/vender" className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
                      <Storefront size={18} weight="bold" /> Tem adega, bar ou distribuidora? Anuncie
                    </Link>
                  )}
                />
              ) : (
                <EstadoVazio emoji="🔎" titulo="Nada encontrado com esse filtro." texto="Tente outra categoria ou limpe a busca." />
              )
            ) : (
              <div className="space-y-6">
                {grupos.map(g => (
                  // Master sozinho ocupa a linha inteira (em 2 colunas sobrava meia linha vazia)
                  <div key={g.plano} className={g.plano === 'master' && g.itens.length === 1 ? 'grid grid-cols-1' : GRADE_POR_PLANO[g.plano]}>
                    {g.itens.map(e => <CardEstabelecimento key={e.id} estabelecimento={e} />)}
                  </div>
                ))}
              </div>
            )}

            {/* Aviso legal obrigatório pra venda de bebida alcoólica. */}
            <p className="mt-12 text-center text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.5)' }}>
              Proibida a venda de bebidas alcoólicas para menores de 18 anos (Lei 13.106/2015).
              <br />
              Aprecie com moderação. Se beber, não dirija.
            </p>
          </main>
        </>
      )}

      <Footer />
      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

function EstadoVazio({ emoji, titulo, texto, acao }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-4 rounded-3xl" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
      {emoji && <div className="text-5xl" aria-hidden="true">{emoji}</div>}
      <p className="text-lg font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{titulo}</p>
      {texto && <p className="text-sm max-w-md" style={{ color: BEER.lavanda }}>{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

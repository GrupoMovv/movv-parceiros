import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { assetUrl } from '../../../services/api';
import { PARCEIROS_INICIAIS, normalizarCategoria } from './parceirosData';
import { PRETO, ROXO } from './theme';
import { Lightning, Trophy, Sparkle, Diamond, Storefront } from '@phosphor-icons/react';
import TopNav from './components/TopNav';
import CategoriaFaixa from './components/CategoriaFaixa';
import HeroBannerCarousel from './components/HeroBannerCarousel';
import CardParceiroCompacto from './components/CardParceiroCompacto';
import SecaoProdutos from './components/SecaoProdutos';
import SecaoParceiros from './components/SecaoParceiros';
import SecaoResultadosBusca from './components/SecaoResultadosBusca';
import CardPromocao from './components/CardPromocao';
import VitrineRotativa from './components/VitrineRotativa';
import VitrineParceirosDestaque from './components/VitrineParceirosDestaque';
import VitrineFechaMes from './components/VitrineFechaMes';
import FechaMesBanner from './components/FechaMesBanner';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import Reveal from './components/Reveal';
import OnboardingTour from './components/OnboardingTour';
import { useFavoritos } from './useFavoritos';
import { useAssociadoSessao } from './useAssociadoSessao';
import { useProdutosSecao, useParceirosCompactos, useBusca } from './useSecaoData';
import { useFechaMesProximo } from './useFechaMes';

export default function Marketplace() {
  const location = useLocation();
  const navigate = useNavigate();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const { alternar: alternarFavorito, ehFavorito } = useFavoritos();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();

  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

  // Captura ANTES do useAssociadoSessao limpar a URL — só assim dá pra saber
  // se essa visita veio do botão "Ir pro IUB MAIS" da carteirinha (é esse o
  // gatilho do tour de primeira vez, não qualquer login).
  const [chegouViaCarteirinha] = useState(() => new URLSearchParams(window.location.search).has('associado'));
  const [tourFechado, setTourFechado] = useState(false);
  const chaveTourVisto = associado?.carteirinha_hash ? `iub_tour_visto_${associado.carteirinha_hash}` : null;
  const mostrarTour = chegouViaCarteirinha && !carregandoAssociado && !!associado && !tourFechado
    && chaveTourVisto && !localStorage.getItem(chaveTourVisto);

  function fecharTour() {
    if (chaveTourVisto) { try { localStorage.setItem(chaveTourVisto, '1'); } catch { /* localStorage indisponível */ } }
    setTourFechado(true);
  }

  // Chegou aqui vindo de outra rota (ex.: clicou "Ofertas" no menu do
  // TopNav estando em /marketplace/food) — TopNav manda o id da âncora via
  // router state porque o elemento só existe depois que ESSA página monta
  // (não dá pra rolar pra um id que ainda não existe no DOM da rota
  // anterior). Limpa o state depois (replace) pra não rolar de novo num
  // back/forward ou reload.
  useEffect(() => {
    const alvo = location.state?.scrollTo;
    if (!alvo) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate(location.pathname, { replace: true, state: null });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { produtos: ofertas, carregando: carregandoOfertas } = useProdutosSecao('/public/marketplace/ofertas-semana', 'promocoes');
  const { produtos: maisVendidos, carregando: carregandoMaisVendidos } = useProdutosSecao('/public/marketplace/mais-vendidos');
  const { produtos: novidades, carregando: carregandoNovidades } = useProdutosSecao('/public/marketplace/novidades');
  const { produtos: exclusivos, carregando: carregandoExclusivos } = useProdutosSecao('/public/marketplace/exclusivos-associados');
  const { parceiros: parceirosCompactos, carregando: carregandoParceiros } = useParceirosCompactos();
  const { info: fechaMesInfo } = useFechaMesProximo();

  const buscaAtiva = searchQuery.trim().length > 0;
  // Busca de verdade contra o catálogo real (produtos + parceiros), ver
  // useBusca/getBusca — antes buscar só filtrava, no cliente, esses
  // parceiros estáticos aqui embaixo (o bug real reportado: "busca
  // sempre mostra a mesma coisa"). Enquanto busca está ativa, essa lista
  // nem é usada pra renderizar (ver JSX), só continua existindo pro modo
  // sem busca (grade normal filtrada por categoria).
  const { produtos: produtosBusca, parceiros: parceirosBusca, carregando: carregandoBusca } = useBusca(searchQuery);

  const parceirosFiltrados = PARCEIROS_INICIAIS
    .filter(p => categoriaAtiva === 'Todas' || p.categorias.some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)));

  function handleSearchSubmit() {
    document.querySelector('#parceiros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Categorias sem página de produtos própria (ver CategoriaFaixa) filtram
  // a grade "Compre de empresas de Itumbiara" aqui embaixo — rola até lá
  // pra pessoa ver o resultado na hora, já que a faixa fica lá no topo.
  function handleSelecionarCategoriaLocal(label) {
    setCategoriaAtiva(label);
    document.querySelector('#parceiros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      {mostrarTour && <OnboardingTour onFechar={fecharTour} />}
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      <FechaMesBanner info={fechaMesInfo} />

      {/* Carrossel primeiro (destaque total, estilo Mercado Livre/Amazon),
          categorias como esteira horizontal logo abaixo — antes ficavam
          flutuando por cima do carrossel (sm+) ou acima dele (mobile),
          competindo pelo topo da página com o herói. */}
      <HeroBannerCarousel fechaMesInfo={fechaMesInfo} />

      <div id="categorias" className="scroll-mt-16 border-b border-slate-100 bg-white">
        {/* padding mobile fica por conta do CategoriaFaixa (px-4 py-4 nele
            mesmo) — aqui só entra padding a partir do sm, senão dobra no
            mobile (ver comentário do próprio CategoriaFaixa.jsx). */}
        <div className="max-w-7xl mx-auto sm:px-8 lg:px-16 sm:py-4">
          <CategoriaFaixa categoriaAtiva={categoriaAtiva} onSelecionar={handleSelecionarCategoriaLocal} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full space-y-8 sm:space-y-10 mt-6">
        <div id="fecha-mes" className="scroll-mt-16">
          <VitrineFechaMes ativoHoje={fechaMesInfo?.ativo_hoje} />
        </div>

        <VitrineParceirosDestaque />

        <SecaoProdutos
          id="ofertas" Icone={Lightning} titulo="Ofertas do Dia"
          produtos={ofertas} carregando={carregandoOfertas} CardComponent={CardPromocao}
        />
        <SecaoProdutos
          id="mais-vendidos" Icone={Trophy} titulo="Mais Vendidos"
          produtos={maisVendidos} carregando={carregandoMaisVendidos}
        />
        <SecaoProdutos
          id="novidades" Icone={Sparkle} titulo="Novidades"
          produtos={novidades} carregando={carregandoNovidades} badge="novo"
        />
        <SecaoProdutos
          id="exclusivos" Icone={Diamond} titulo="Exclusivos para Associados" subtitulo="Ofertas só pra quem tem carteirinha SECI"
          produtos={exclusivos} carregando={carregandoExclusivos} badge="exclusivo"
        />

        <VitrineRotativa />

        {!nomeAssociado && !carregandoExclusivos && exclusivos.length > 0 && (
          <p className="text-center text-sm text-slate-500 -mt-6">
            Ainda não é associado?{' '}
            <a href="/cadastrar-associado" className="font-semibold underline" style={{ color: PRETO }}>Vire associado grátis pra aproveitar</a>
          </p>
        )}

        <Reveal>
          <section id="lojas" className="scroll-mt-16">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
              <Storefront size={20} weight="duotone" color={ROXO} /> Lojas em Destaque
            </h2>
            {carregandoParceiros ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[68px] rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {parceirosCompactos.map(p => <CardParceiroCompacto key={p.id} parceiro={p} />)}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <div id="parceiros" className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 w-full flex-1 space-y-8 scroll-mt-16 mt-8">
        {buscaAtiva ? (
          <SecaoResultadosBusca
            termo={searchQuery.trim()}
            produtos={produtosBusca}
            parceiros={parceirosBusca}
            carregando={carregandoBusca}
          />
        ) : (
          <SecaoParceiros
            titulo={categoriaAtiva === 'Todas' ? 'Compre de empresas de Itumbiara' : categoriaAtiva}
            parceiros={parceirosFiltrados}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Nenhum parceiro encontrado."
          />
        )}
      </div>

      <Footer />

      <MobileBottomNav
        nomeAssociado={nomeAssociado}
        onLoginSuccess={recarregar}
      />
    </div>
  );
}

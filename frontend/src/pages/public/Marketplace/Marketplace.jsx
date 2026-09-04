import { useState } from 'react';
import { assetUrl } from '../../../services/api';
import { PARCEIROS_INICIAIS, normalizarCategoria } from './parceirosData';
import { PRETO, ROXO } from './theme';
import { Lightning, Trophy, Sparkle, Diamond, Storefront } from '@phosphor-icons/react';
import TopNav from './components/TopNav';
import CategoriaFaixa from './components/CategoriaFaixa';
import HeroBannerCarousel from './components/HeroBannerCarousel';
import PartnerCard from './components/PartnerCard';
import CardParceiroCompacto from './components/CardParceiroCompacto';
import SecaoProdutos from './components/SecaoProdutos';
import CardPromocao from './components/CardPromocao';
import VitrineRotativa from './components/VitrineRotativa';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import Reveal from './components/Reveal';
import { useFavoritos } from './useFavoritos';
import { useAssociadoSessao } from './useAssociadoSessao';
import { useProdutosSecao, useParceirosCompactos } from './useSecaoData';

export default function Marketplace() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);
  const { favoritos, alternar: alternarFavorito, ehFavorito } = useFavoritos();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();

  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

  const { produtos: ofertas, carregando: carregandoOfertas } = useProdutosSecao('/public/marketplace/ofertas-semana', 'promocoes');
  const { produtos: maisVendidos, carregando: carregandoMaisVendidos } = useProdutosSecao('/public/marketplace/mais-vendidos');
  const { produtos: novidades, carregando: carregandoNovidades } = useProdutosSecao('/public/marketplace/novidades');
  const { produtos: exclusivos, carregando: carregandoExclusivos } = useProdutosSecao('/public/marketplace/exclusivos-associados');
  const { parceiros: parceirosCompactos, carregando: carregandoParceiros } = useParceirosCompactos();

  const buscaAtiva = searchQuery.trim().length > 0;
  const buscaNormalizada = normalizarCategoria(searchQuery.trim());

  const combinaBusca = (p) => !buscaNormalizada
    || normalizarCategoria(p.nome).includes(buscaNormalizada)
    || normalizarCategoria(p.descricao).includes(buscaNormalizada);

  const parceirosFiltrados = PARCEIROS_INICIAIS
    .filter(p => categoriaAtiva === 'Todas' || p.categorias.some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)))
    .filter(p => !mostrarFavoritos || ehFavorito(p.slug))
    .filter(combinaBusca);

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
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carregandoAssociado={carregandoAssociado}
        favoritosAtivos={mostrarFavoritos}
        onToggleFavoritos={() => setMostrarFavoritos(v => !v)}
        qtdFavoritos={favoritos.length}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* categorias flutuam sobre o banner a partir do tablet (fundo branco
          garante legibilidade); no mobile ficam em fluxo normal, acima do
          banner, porque não sobra altura suficiente pra sobrepor sem
          esconder o conteúdo do slide. */}
      <div className="relative">
        <div id="categorias" className="scroll-mt-16 sm:absolute sm:top-0 sm:inset-x-0 sm:z-10">
          <div className="border-b border-slate-100 sm:border-0 sm:max-w-7xl sm:mx-auto sm:px-8 lg:px-16 sm:pt-5 lg:pt-6">
            <div className="bg-white sm:rounded-2xl sm:shadow-lg sm:p-3 lg:p-4">
              <CategoriaFaixa categoriaAtiva={categoriaAtiva} onSelecionar={handleSelecionarCategoriaLocal} />
            </div>
          </div>
        </div>

        <HeroBannerCarousel associado={associado} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full space-y-8 sm:space-y-10 mt-6">
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
        {mostrarFavoritos ? (
          <SecaoParceiros
            titulo="Seus favoritos"
            parceiros={parceirosFiltrados}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Você ainda não favoritou nenhum parceiro."
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
        favoritosAtivos={mostrarFavoritos}
        onToggleFavoritos={() => setMostrarFavoritos(v => !v)}
        nomeAssociado={nomeAssociado}
        onLoginSuccess={recarregar}
      />
    </div>
  );
}

function SecaoParceiros({ titulo, parceiros, ehFavorito, onToggleFavorito, vazio }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
        📍 {titulo}
      </h2>
      {parceiros.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">{vazio}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {parceiros.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 10) * 40}>
              <PartnerCard
                parceiro={p}
                favorito={ehFavorito(p.slug)}
                onToggleFavorito={onToggleFavorito}
              />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

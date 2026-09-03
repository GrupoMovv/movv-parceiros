import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { PARCEIROS_INICIAIS, CATEGORIAS_FILTRO, normalizarCategoria } from './parceirosData';
import { PRETO } from './theme';
import TopNav from './components/TopNav';
import HeroPremium from './components/HeroPremium';
import SearchFilterBar from './components/SearchFilterBar';
import CategoryScroll from './components/CategoryScroll';
import PartnerCard from './components/PartnerCard';
import CardCategoria from './components/CardCategoria';
import CardParceiroCompacto from './components/CardParceiroCompacto';
import SecaoProdutos from './components/SecaoProdutos';
import CtaVenderRodape from './components/CtaVenderRodape';
import Footer from './components/Footer';
import Reveal from './components/Reveal';
import { useFavoritos } from './useFavoritos';
import { useProdutosSecao, useCategorias, useParceirosCompactos } from './useSecaoData';

// Mapeia a categoria fixa da vitrine "Explore por categoria" (slug do
// Bloco 8) pra um label do filtro de parceiros já existente — se não
// existir correspondência (ex.: "Fitness", que hoje nenhum parceiro usa),
// cai em "Todas" em vez de forçar um valor inválido no <select>.
function mapearCategoriaSlugParaFiltro(slug) {
  const alvo = normalizarCategoria(slug.replace(/-/g, ' '));
  const encontrada = CATEGORIAS_FILTRO.find(c => normalizarCategoria(c.label).includes(alvo) || alvo.includes(normalizarCategoria(c.label)));
  return encontrada?.label || 'Todas';
}

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const { categoriaSlug } = useParams();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [bairroAtivo, setBairroAtivo] = useState('Todos');
  const [nomeAssociado, setNomeAssociado] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);
  const [carregandoAssociado, setCarregandoAssociado] = useState(false);
  const [qtdAssociados, setQtdAssociados] = useState(null);
  const { favoritos, alternar: alternarFavorito, ehFavorito } = useFavoritos();

  const associadoHash = searchParams.get('associado');

  useEffect(() => {
    if (associadoHash) {
      setCarregandoAssociado(true);
      api.get(`/public/carteirinha/${associadoHash}`)
        .then(res => setNomeAssociado(res.data.nome?.trim().split(/\s+/)[0] || null))
        .catch(() => {})
        .finally(() => setCarregandoAssociado(false));
      return;
    }
    if (getPainelToken()) {
      setCarregandoAssociado(true);
      apiPainel.get('/public/painel/me')
        .then(res => setNomeAssociado(res.data.nome_completo?.trim().split(/\s+/)[0] || null))
        .catch(() => {})
        .finally(() => setCarregandoAssociado(false));
    }
  }, [associadoHash]);

  useEffect(() => {
    api.get('/public/marketplace/stats').then(res => setQtdAssociados(res.data.associados)).catch(() => {});
  }, []);

  // Vem da rota /marketplace/categoria/:slug (cards da seção "Explore por
  // categoria") — sincroniza com o filtro sempre que o slug da URL muda,
  // inclusive voltando pra "Todas" se o usuário navegar pra /marketplace puro.
  useEffect(() => {
    setCategoriaAtiva(categoriaSlug ? mapearCategoriaSlugParaFiltro(categoriaSlug) : 'Todas');
    if (categoriaSlug) document.querySelector('#parceiros')?.scrollIntoView({ block: 'start' });
  }, [categoriaSlug]);

  const { produtos: ofertas, carregando: carregandoOfertas } = useProdutosSecao('/public/marketplace/ofertas-semana');
  const { produtos: exclusivos, carregando: carregandoExclusivos } = useProdutosSecao('/public/marketplace/exclusivos-associados');
  const { produtos: novidades, carregando: carregandoNovidades } = useProdutosSecao('/public/marketplace/novidades');
  const { produtos: maisVendidos, carregando: carregandoMaisVendidos } = useProdutosSecao('/public/marketplace/mais-vendidos');
  const { categorias, carregando: carregandoCategorias } = useCategorias();
  const { parceiros: parceirosCompactos, carregando: carregandoParceiros } = useParceirosCompactos();

  const carregandoVitrine = carregandoOfertas || carregandoExclusivos || carregandoNovidades || carregandoMaisVendidos;
  const semNenhumProduto = !carregandoVitrine
    && ofertas.length === 0 && exclusivos.length === 0 && novidades.length === 0 && maisVendidos.length === 0;

  const buscaAtiva = searchQuery.trim().length > 0;
  const buscaNormalizada = normalizarCategoria(searchQuery.trim());
  const bairroNormalizado = normalizarCategoria(bairroAtivo);

  const combinaBusca = (p) => !buscaNormalizada
    || normalizarCategoria(p.nome).includes(buscaNormalizada)
    || normalizarCategoria(p.descricao).includes(buscaNormalizada);

  const combinaBairro = (p) => bairroAtivo === 'Todos' || normalizarCategoria(p.endereco).includes(bairroNormalizado);

  const parceirosFiltrados = PARCEIROS_INICIAIS
    .filter(p => categoriaAtiva === 'Todas' || p.categorias.some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)))
    .filter(p => !mostrarFavoritos || ehFavorito(p.slug))
    .filter(combinaBusca)
    .filter(combinaBairro);

  const modoNavegacao = buscaAtiva || mostrarFavoritos || categoriaAtiva !== 'Todas' || bairroAtivo !== 'Todos';

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      <TopNav
        nomeAssociado={nomeAssociado}
        carregandoAssociado={carregandoAssociado}
        favoritosAtivos={mostrarFavoritos}
        onToggleFavoritos={() => setMostrarFavoritos(v => !v)}
        qtdFavoritos={favoritos.length}
      />

      {!modoNavegacao && <HeroPremium nomeAssociado={nomeAssociado} />}

      {!modoNavegacao && (
        <div className="max-w-7xl mx-auto px-8 lg:px-16 w-full space-y-16 sm:space-y-20 mt-14 sm:mt-20">
          {semNenhumProduto ? (
            <Reveal>
              <div className="text-center py-16 bg-slate-50 rounded-3xl">
                <p className="text-4xl">🛍️</p>
                <p className="font-bold text-lg mt-3" style={{ color: PRETO }}>Em breve, mais produtos</p>
                <p className="text-slate-500 text-sm mt-1">Nossos parceiros estão cadastrando as ofertas. Volte em breve!</p>
              </div>
            </Reveal>
          ) : (
            <>
              <SecaoProdutos
                id="ofertas" emoji="🔥" titulo="Ofertas da semana" subtitulo="Maiores descontos da casa"
                produtos={ofertas} carregando={carregandoOfertas} badge="desconto"
              />
              <SecaoProdutos
                emoji="💎" titulo="Exclusivos para associados" subtitulo="Ofertas só pra quem tem carteirinha SECI"
                produtos={exclusivos} carregando={carregandoExclusivos} badge="exclusivo"
              />
            </>
          )}

          {!nomeAssociado && !carregandoExclusivos && exclusivos.length > 0 && (
            <Reveal className="-mt-10 sm:-mt-14">
              <p className="text-center text-sm text-slate-500">
                Ainda não é associado?{' '}
                <a href="/cadastrar" className="font-semibold underline" style={{ color: PRETO }}>Vire associado grátis pra aproveitar</a>
              </p>
            </Reveal>
          )}

          <Reveal>
            <section>
              <h2 className="text-2xl font-bold tracking-tight mb-5" style={{ color: PRETO }}>🛍️ Explore por categoria</h2>
              {carregandoCategorias ? (
                <div className="flex gap-4 overflow-x-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-16 h-16 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-5 sm:gap-8 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                  {categorias.map(c => <CardCategoria key={c.slug} categoria={c} />)}
                </div>
              )}
            </section>
          </Reveal>

          <SecaoProdutos emoji="🆕" titulo="Novidades" produtos={novidades} carregando={carregandoNovidades} badge="novo" />

          <Reveal>
            <section id="parceiros-vitrine">
              <h2 className="text-2xl font-bold tracking-tight mb-5" style={{ color: PRETO }}>🏪 Nossos parceiros</h2>
              {carregandoParceiros ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[76px] rounded-2xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {parceirosCompactos.map(p => <CardParceiroCompacto key={p.id} parceiro={p} />)}
                </div>
              )}
            </section>
          </Reveal>

          <SecaoProdutos emoji="🏆" titulo="Mais vendidos da semana" produtos={maisVendidos} carregando={carregandoMaisVendidos} />
        </div>
      )}

      {/* SearchFilterBar tem -mt-8 embutido (pensado pra "flutuar" colado no
          rodapé do Hero) — como agora vem depois de toda a vitrine, esse
          wrapper com mt-16 evita sobrepor a última seção acima. */}
      <div className={modoNavegacao ? undefined : 'mt-16'}>
        <SearchFilterBar
          categorias={CATEGORIAS_FILTRO}
          categoriaAtiva={categoriaAtiva}
          setCategoriaAtiva={setCategoriaAtiva}
          bairroAtivo={bairroAtivo}
          setBairroAtivo={setBairroAtivo}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <CategoryScroll categorias={CATEGORIAS_FILTRO} ativa={categoriaAtiva} onSelecionar={setCategoriaAtiva} />

      <div id="parceiros" className="max-w-5xl mx-auto px-8 lg:px-16 py-10 w-full flex-1 space-y-16 scroll-mt-[70px]">
        {mostrarFavoritos && (
          <SecaoParceiros
            titulo="Seus favoritos"
            parceiros={parceirosFiltrados}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Você ainda não favoritou nenhum parceiro."
          />
        )}

        {!mostrarFavoritos && (
          <SecaoParceiros
            titulo={categoriaAtiva === 'Todas' ? 'Todos os parceiros' : categoriaAtiva}
            parceiros={parceirosFiltrados}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Nenhum parceiro encontrado."
          />
        )}
      </div>

      {!modoNavegacao && <CtaVenderRodape qtdAssociados={qtdAssociados} />}

      <Footer />
    </div>
  );
}

function SecaoParceiros({ titulo, parceiros, ehFavorito, onToggleFavorito, vazio }) {
  if (parceiros.length === 0 && !vazio) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mb-5" style={{ color: PRETO }}>{titulo}</h2>
      {parceiros.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">{vazio}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {parceiros.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 8) * 60}>
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

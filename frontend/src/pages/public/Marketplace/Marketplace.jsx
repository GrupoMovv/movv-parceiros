import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { PARCEIROS_INICIAIS, CATEGORIAS_FILTRO, normalizarCategoria } from './parceirosData';
import { PRETO, DOURADO } from './theme';
import TopNav from './components/TopNav';
import HeroPremium from './components/HeroPremium';
import PartnerMarquee from './components/PartnerMarquee';
import SponsoredPartners from './components/SponsoredPartners';
import SearchFilterBar from './components/SearchFilterBar';
import CategoryScroll from './components/CategoryScroll';
import PartnerCard from './components/PartnerCard';
import Footer from './components/Footer';
import Reveal from './components/Reveal';
import { useFavoritos } from './useFavoritos';

// Ofertas hardcoded — Fase 1. Ver TODO em parceirosData.js.
const OFERTAS_DA_SEMANA = [
  { titulo: 'Óticas Diniz', texto: '20% de desconto em armações e lentes', slug: 'oticas-diniz' },
  { titulo: 'Nossa Drogaria', texto: 'Super descontos em medicamentos', slug: 'nossa-drogaria' },
  { titulo: 'Academia Atlética', texto: 'Mensalidade especial por R$ 30,00', slug: 'academia-atletica' },
];

// Ate o Portal do Parceiro ter o sistema Premium, os "patrocinados" sao so
// os 3 primeiros da lista — combinado explicitamente, isso vira dinamico
// quando existir assinatura de destaque de verdade.
const PARCEIROS_DESTAQUE = PARCEIROS_INICIAIS.slice(0, 3);

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [bairroAtivo, setBairroAtivo] = useState('Todos');
  const [nomeAssociado, setNomeAssociado] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);
  const [carregandoAssociado, setCarregandoAssociado] = useState(false);
  const { favoritos, alternar: alternarFavorito, ehFavorito } = useFavoritos();

  useEffect(() => {
    const hash = searchParams.get('associado');
    if (hash) {
      setCarregandoAssociado(true);
      api.get(`/public/carteirinha/${hash}`)
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
  }, [searchParams]);

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

  const exclusivos = parceirosFiltrados.filter(p => p.exclusivo);
  const novidades = parceirosFiltrados.filter(p => p.novo);

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

      {!modoNavegacao && (
        <>
          <HeroPremium />
          <PartnerMarquee parceiros={PARCEIROS_INICIAIS} />
          <SponsoredPartners parceiros={PARCEIROS_DESTAQUE} />
        </>
      )}

      <SearchFilterBar
        categorias={CATEGORIAS_FILTRO}
        categoriaAtiva={categoriaAtiva}
        setCategoriaAtiva={setCategoriaAtiva}
        bairroAtivo={bairroAtivo}
        setBairroAtivo={setBairroAtivo}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <CategoryScroll categorias={CATEGORIAS_FILTRO} ativa={categoriaAtiva} onSelecionar={setCategoriaAtiva} />

      <div id="parceiros" className="max-w-5xl mx-auto px-8 lg:px-16 py-10 w-full flex-1 space-y-16 scroll-mt-[70px]">
        {!modoNavegacao && (
          <section id="ofertas" className="scroll-mt-[70px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Selecionadas pra você</p>
            <h2 className="text-2xl font-bold tracking-tight mb-5" style={{ color: PRETO }}>Ofertas da semana</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {OFERTAS_DA_SEMANA.map(o => (
                <Link
                  key={o.slug} to={`/marketplace/parceiro/${o.slug}`}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out"
                >
                  <span
                    className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2.5"
                    style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}
                  >
                    Oferta
                  </span>
                  <p className="text-sm font-bold" style={{ color: PRETO }}>{o.titulo}</p>
                  <p className="text-slate-500 text-sm mt-1">{o.texto}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {mostrarFavoritos && (
          <SecaoParceiros
            titulo="Seus favoritos"
            parceiros={parceirosFiltrados}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Você ainda não favoritou nenhum parceiro."
          />
        )}

        {!mostrarFavoritos && exclusivos.length > 0 && (
          <SecaoParceiros
            titulo="Exclusivo para associados"
            parceiros={exclusivos}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
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

        {!mostrarFavoritos && !modoNavegacao && novidades.length > 0 && (
          <SecaoParceiros
            titulo="Novidades"
            parceiros={novidades}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
          />
        )}
      </div>

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

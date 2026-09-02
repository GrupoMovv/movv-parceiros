import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { PARCEIROS_INICIAIS, CATEGORIAS_FILTRO, normalizarCategoria } from './parceirosData';
import { ROXO_ESCURO, DOURADO, GRAFITE } from './theme';
import Header from './components/Header';
import HeroCarousel from './components/HeroCarousel';
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

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
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

  const combinaBusca = (p) => !buscaNormalizada
    || normalizarCategoria(p.nome).includes(buscaNormalizada)
    || normalizarCategoria(p.descricao).includes(buscaNormalizada);

  const parceirosFiltrados = PARCEIROS_INICIAIS
    .filter(p => categoriaAtiva === 'Todas' || p.categorias.some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)))
    .filter(p => !mostrarFavoritos || ehFavorito(p.slug))
    .filter(combinaBusca);

  const exclusivos = parceirosFiltrados.filter(p => p.exclusivo);
  const novidades = parceirosFiltrados.filter(p => p.novo);

  const modoNavegacao = buscaAtiva || mostrarFavoritos || categoriaAtiva !== 'Todas';

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      <Header
        nomeAssociado={nomeAssociado}
        carregandoAssociado={carregandoAssociado}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        favoritosAtivos={mostrarFavoritos}
        onToggleFavoritos={() => setMostrarFavoritos(v => !v)}
        qtdFavoritos={favoritos.length}
      />

      {!modoNavegacao && <HeroCarousel />}

      {/* Ofertas da semana */}
      {!modoNavegacao && (
        <div className="max-w-5xl mx-auto px-4 pt-8 w-full">
          <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'linear-gradient(120deg, #FEF9E7 0%, #FDF3D1 100%)', border: `1px solid ${DOURADO}44` }}>
            <p className="font-black text-sm sm:text-base flex items-center gap-1.5" style={{ color: GRAFITE }}>
              🔥 OFERTAS DA SEMANA
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
              {OFERTAS_DA_SEMANA.map(o => (
                <Link
                  key={o.slug} to={`/marketplace/parceiro/${o.slug}`}
                  className="bg-white rounded-xl px-3.5 py-3 border transition-shadow hover:shadow-md"
                  style={{ borderColor: `${DOURADO}55` }}
                >
                  <p className="text-xs font-bold" style={{ color: ROXO_ESCURO }}>{o.titulo}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{o.texto}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <CategoryScroll categorias={CATEGORIAS_FILTRO} ativa={categoriaAtiva} onSelecionar={setCategoriaAtiva} />

      <div className="max-w-5xl mx-auto px-4 py-6 w-full flex-1 space-y-10">
        {mostrarFavoritos && (
          <SecaoParceiros
            titulo="❤️ SEUS FAVORITOS"
            parceiros={parceirosFiltrados}
            favoritos={favoritos}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Você ainda não favoritou nenhum parceiro."
          />
        )}

        {!mostrarFavoritos && exclusivos.length > 0 && (
          <SecaoParceiros
            titulo="💎 EXCLUSIVO ASSOCIADO"
            parceiros={exclusivos}
            favoritos={favoritos}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
          />
        )}

        {!mostrarFavoritos && (
          <SecaoParceiros
            titulo={categoriaAtiva === 'Todas' ? '🏪 TODOS OS PARCEIROS' : `🏪 ${categoriaAtiva.toUpperCase()}`}
            parceiros={parceirosFiltrados}
            favoritos={favoritos}
            ehFavorito={ehFavorito}
            onToggleFavorito={alternarFavorito}
            vazio="Nenhum parceiro encontrado."
          />
        )}

        {!mostrarFavoritos && !modoNavegacao && novidades.length > 0 && (
          <SecaoParceiros
            titulo="🆕 NOVIDADES"
            parceiros={novidades}
            favoritos={favoritos}
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
      <h2 className="font-black text-sm sm:text-base mb-3.5" style={{ color: GRAFITE }}>{titulo}</h2>
      {parceiros.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">{vazio}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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

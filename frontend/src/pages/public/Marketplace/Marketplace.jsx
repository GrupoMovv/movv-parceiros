import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles, Tag } from 'lucide-react';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { PARCEIROS_INICIAIS, CATEGORIAS_FILTRO, normalizarCategoria } from './parceirosData';

const ROXO = '#6B46C1';
const ROXO_ESCURO = '#4C1D95';
const DOURADO = '#D4AF37';
const GRAFITE = '#1F2937';

// Ofertas hardcoded — Fase 1. Ver TODO em parceirosData.js.
const OFERTAS_EXCLUSIVAS = [
  { titulo: 'Óticas Diniz', texto: '20% de desconto em armações e lentes', slug: 'oticas-diniz' },
  { titulo: 'Nossa Drogaria', texto: 'Super descontos em medicamentos', slug: 'nossa-drogaria' },
  { titulo: 'Academia Atlética', texto: 'Mensalidade especial por R$ 30,00', slug: 'academia-atletica' },
];

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [nomeAssociado, setNomeAssociado] = useState(null);

  useEffect(() => {
    const hash = searchParams.get('associado');
    if (hash) {
      api.get(`/public/carteirinha/${hash}`)
        .then(res => setNomeAssociado(res.data.nome?.trim().split(/\s+/)[0] || null))
        .catch(() => {});
      return;
    }
    if (getPainelToken()) {
      apiPainel.get('/public/painel/me')
        .then(res => setNomeAssociado(res.data.nome_completo?.trim().split(/\s+/)[0] || null))
        .catch(() => {});
    }
  }, [searchParams]);

  const parceirosFiltrados = categoriaAtiva === 'Todas'
    ? PARCEIROS_INICIAIS
    : PARCEIROS_INICIAIS.filter(p => p.categorias.some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)));

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Header */}
      <div className="relative px-6 pt-10 pb-8 text-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)' }}
        />
        <p className="relative text-2xl mb-1">🛍️📍</p>
        <h1 className="relative font-black text-2xl sm:text-3xl tracking-tight">
          <span style={{ color: DOURADO }}>IUB</span> <span className="text-white">MARKETPLACE</span>
        </h1>
        <p className="relative text-white/80 text-sm mt-2 max-w-xs mx-auto">Compre de quem faz parte da nossa comunidade</p>

        {nomeAssociado && (
          <div className="relative mt-5 inline-block bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3">
            <p className="text-white font-bold text-base">Olá, {nomeAssociado}! 👋</p>
            <p className="text-white/70 text-xs mt-0.5">Confira as ofertas disponíveis pra você</p>
          </div>
        )}
      </div>

      {/* Ofertas exclusivas */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'linear-gradient(120deg, #FEF9E7 0%, #FDF3D1 100%)', border: `1px solid ${DOURADO}44` }}>
          <p className="font-black text-sm sm:text-base flex items-center gap-1.5" style={{ color: GRAFITE }}>
            🔥 OFERTAS EXCLUSIVAS PARA ASSOCIADOS
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
            {OFERTAS_EXCLUSIVAS.map(o => (
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

      {/* Filtro de categorias */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 mt-6 overflow-x-auto">
        <div className="flex gap-2 max-w-5xl mx-auto w-fit sm:w-full">
          {CATEGORIAS_FILTRO.map(c => (
            <button
              key={c.label}
              onClick={() => setCategoriaAtiva(c.label)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={categoriaAtiva === c.label
                ? { backgroundColor: ROXO, color: 'white' }
                : { backgroundColor: '#F3F4F6', color: '#4B5563' }}
            >
              {c.emoji ? `${c.emoji} ${c.label}` : c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de parceiros */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {parceirosFiltrados.map(p => (
            <CardParceiro key={p.slug} parceiro={p} />
          ))}
        </div>

        {parceirosFiltrados.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">Nenhum parceiro nessa categoria ainda.</p>
        )}
      </div>

      {/* Rodapé */}
      <div className="text-center px-6 py-10 space-y-2 bg-slate-50">
        <p className="text-slate-500 text-sm flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4" style={{ color: DOURADO }} />
          Você está no IUB MARKETPLACE — benefícios exclusivos SECI
        </p>
        <Link to="/cadastrar" className="inline-block text-sm font-semibold underline" style={{ color: ROXO_ESCURO }}>
          Faça sua carteirinha digital
        </Link>
      </div>
    </div>
  );
}

function CardParceiro({ parceiro }) {
  return (
    <Link
      to={`/marketplace/parceiro/${parceiro.slug}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3"
        style={{ backgroundColor: `${parceiro.corIcone}22` }}
      >
        {parceiro.icone}
      </div>

      <h2 className="font-bold text-sm leading-tight" style={{ color: GRAFITE }}>{parceiro.nome}</h2>
      <p className="text-slate-500 text-xs mt-1 leading-snug flex-1 line-clamp-2">{parceiro.descricao}</p>

      <span
        className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold px-2.5 py-1 rounded-full w-fit"
        style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}
      >
        <Tag className="w-2.5 h-2.5" /> BENEFÍCIO DO ASSOCIADO
      </span>

      <span
        className="mt-3 text-center text-xs font-semibold py-2 rounded-xl text-white"
        style={{ backgroundColor: ROXO }}
      >
        Ver detalhes
      </span>
    </Link>
  );
}

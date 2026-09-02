import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Instagram, MapPin, Tag, Star, Navigation } from 'lucide-react';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { buscarParceiroPorSlug } from './parceirosData';
import { ROXO, ROXO_ESCURO, DOURADO, GRAFITE } from './theme';

export default function ParceiroDetalhe() {
  const { slug } = useParams();
  const parceiro = buscarParceiroPorSlug(slug);

  if (!parceiro) return <Navigate to="/marketplace" replace />;

  const mensagem = `Olá! Sou associado do SECI e gostaria de saber mais sobre os benefícios da ${parceiro.nome}.`;
  const linkWpp = parceiro.whatsapp ? linkWhatsappComTexto(parceiro.whatsapp, mensagem) : null;

  // TODO Fase 2: instagram / googleMapsUrl / horario / produtos / promocoes /
  // cupom vêm da tabela sindicato_parceiros — hoje nenhum parceiro tem esses
  // dados, então essas seções só aparecem quando existirem.
  const temInstagram = Boolean(parceiro.instagram);
  const temMaps = Boolean(parceiro.googleMapsUrl);
  const temProdutos = Array.isArray(parceiro.produtos) && parceiro.produtos.length > 0;
  const temPromocoes = Array.isArray(parceiro.promocoes) && parceiro.promocoes.length > 0;
  const temCupom = Boolean(parceiro.cupom);
  const temLocalizacao = temMaps || Boolean(parceiro.endereco);

  const TABS = [
    { id: 'ofertas', label: 'Ofertas' },
    ...(temProdutos ? [{ id: 'produtos', label: 'Produtos' }] : []),
    { id: 'sobre', label: 'Sobre' },
    ...(temLocalizacao ? [{ id: 'local', label: 'Localização' }] : []),
  ];
  const [tab, setTab] = useState('ofertas');

  const corDegrade = `linear-gradient(150deg, ${ROXO_ESCURO} 0%, ${parceiro.corIcone || ROXO} 130%)`;

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Banner / cover */}
      <div className="relative px-6 pt-8 pb-14 text-center overflow-hidden" style={{ background: corDegrade }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)' }}
        />
        <Link to="/marketplace" className="relative inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Marketplace
        </Link>

        {parceiro.exclusivo && (
          <span
            className="relative inline-flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wide mb-3 shadow-lg"
            style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
          >
            💎 Exclusivo associado
          </span>
        )}

        <div
          className="relative w-24 h-24 rounded-3xl flex items-center justify-center text-6xl mx-auto shadow-2xl"
          style={{ backgroundColor: 'white' }}
        >
          {parceiro.icone}
        </div>
        <h1 className="relative text-white font-black text-xl sm:text-3xl mt-4">{parceiro.nome}</h1>

        <div className="relative flex items-center justify-center gap-1 mt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5" style={{ color: DOURADO }} fill={DOURADO} />
          ))}
          <span className="text-white/80 text-xs font-semibold ml-1">5.0</span>
        </div>

        {parceiro.endereco && (
          <p className="relative text-white/70 text-xs mt-2 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {parceiro.endereco}
          </p>
        )}

        <div className="relative flex items-center justify-center gap-2 mt-5 flex-wrap">
          {linkWpp ? (
            <a href={linkWpp} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white transition-transform hover:scale-105"
              style={{ backgroundColor: '#25D366' }}>
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white/60 bg-white/10">
              <MessageCircle className="w-3.5 h-3.5" /> Em breve
            </span>
          )}
          {temInstagram && (
            <a href={parceiro.instagram} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white bg-white/10 hover:bg-white/20 transition-colors">
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </a>
          )}
          {temMaps && (
            <a href={parceiro.googleMapsUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white bg-white/10 hover:bg-white/20 transition-colors">
              <Navigation className="w-3.5 h-3.5" /> Como chegar
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 -mt-6 rounded-t-3xl shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
        <div className="max-w-2xl mx-auto flex px-5">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative px-4 py-4 text-xs sm:text-sm font-bold transition-colors"
              style={{ color: tab === t.id ? ROXO_ESCURO : '#9CA3AF' }}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute left-4 right-4 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: ROXO_ESCURO }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {tab === 'ofertas' && (
          <div className="space-y-5">
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}
            >
              <span className="flex-shrink-0 text-lg">🏷️</span>
              <div>
                <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#92700C' }}>Benefício exclusivo pra associados</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: GRAFITE }}>{parceiro.beneficio}</p>
              </div>
            </div>

            {temCupom && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${ROXO}10`, border: `1px dashed ${ROXO}` }}>
                <p className="text-xs font-semibold text-slate-500">Cupom exclusivo pra você</p>
                <p className="text-xl font-black tracking-widest mt-1" style={{ color: ROXO_ESCURO }}>{parceiro.cupom}</p>
              </div>
            )}

            {temPromocoes ? (
              <div>
                <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5" style={{ color: GRAFITE }}>🔥 Promoções ativas</h2>
                <div className="space-y-2">
                  {parceiro.promocoes.map((promo, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ backgroundColor: `${DOURADO}15` }}>
                      <p className="text-sm font-semibold" style={{ color: GRAFITE }}>{promo.titulo}</p>
                      {promo.descricao && <p className="text-slate-500 text-xs mt-0.5">{promo.descricao}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-400 text-xs py-6">Novas promoções em breve por aqui.</p>
            )}
          </div>
        )}

        {tab === 'produtos' && temProdutos && (
          <div className="grid grid-cols-2 gap-3">
            {parceiro.produtos.map((produto, i) => (
              <div key={i} className="border border-slate-100 rounded-2xl p-3 shadow-sm">
                {produto.foto && <img src={produto.foto} alt={produto.nome} loading="lazy" className="w-full h-24 object-cover rounded-lg mb-2" />}
                <p className="text-xs font-semibold" style={{ color: GRAFITE }}>{produto.nome}</p>
                {produto.preco && <p className="text-xs font-bold mt-0.5" style={{ color: ROXO_ESCURO }}>{produto.preco}</p>}
                {parceiro.whatsapp && (
                  <a
                    href={linkWhatsappComTexto(parceiro.whatsapp, `Olá! Tenho interesse em: ${produto.nome}`)}
                    target="_blank" rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg text-white"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'sobre' && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm leading-relaxed">{parceiro.descricao}</p>
            <div className="flex flex-wrap gap-1.5">
              {parceiro.categorias.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  <Tag className="w-2.5 h-2.5" /> {c}
                </span>
              ))}
            </div>
            {parceiro.endereco && (
              <p className="text-slate-500 text-xs flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {parceiro.endereco}
              </p>
            )}
          </div>
        )}

        {tab === 'local' && temLocalizacao && (
          <div className="space-y-4">
            {parceiro.endereco && (
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: GRAFITE }}>
                <MapPin className="w-4 h-4" style={{ color: ROXO }} /> {parceiro.endereco}
              </p>
            )}
            {temMaps ? (
              <a
                href={parceiro.googleMapsUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: ROXO }}
              >
                <Navigation className="w-4 h-4" /> Como chegar no Google Maps
              </a>
            ) : (
              <p className="text-center text-slate-400 text-xs py-4">Localização no mapa em breve.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

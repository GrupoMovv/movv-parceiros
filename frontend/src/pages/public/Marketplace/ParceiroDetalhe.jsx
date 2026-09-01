import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Instagram, MapPin, Tag } from 'lucide-react';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { buscarParceiroPorSlug } from './parceirosData';

const ROXO = '#6B46C1';
const ROXO_ESCURO = '#4C1D95';
const DOURADO = '#D4AF37';
const GRAFITE = '#1F2937';

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

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Header */}
      <div className="relative px-6 pt-8 pb-10 text-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)' }}
        />
        <Link to="/marketplace" className="relative inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Marketplace
        </Link>

        <div
          className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-5xl mx-auto shadow-xl"
          style={{ backgroundColor: 'white' }}
        >
          {parceiro.icone}
        </div>
        <h1 className="relative text-white font-black text-xl sm:text-2xl mt-4">{parceiro.nome}</h1>
        {parceiro.endereco && (
          <p className="relative text-white/70 text-xs mt-1.5 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {parceiro.endereco}
          </p>
        )}

        <div className="relative flex items-center justify-center gap-2 mt-5 flex-wrap">
          {linkWpp ? (
            <a href={linkWpp} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white"
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
              <MapPin className="w-3.5 h-3.5" /> Google Maps
            </a>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {/* Descrição + selo de benefício */}
        <div>
          <p className="text-slate-600 text-sm leading-relaxed">{parceiro.descricao}</p>
          <div
            className="mt-4 rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}
          >
            <span className="flex-shrink-0 text-lg">🏷️</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#92700C' }}>Benefício exclusivo pra associados</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: GRAFITE }}>{parceiro.beneficio}</p>
            </div>
          </div>
        </div>

        {/* Cupom exclusivo */}
        {temCupom && (
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${ROXO}10`, border: `1px dashed ${ROXO}` }}>
            <p className="text-xs font-semibold text-slate-500">Cupom exclusivo pra você</p>
            <p className="text-xl font-black tracking-widest mt-1" style={{ color: ROXO_ESCURO }}>{parceiro.cupom}</p>
          </div>
        )}

        {/* Promoções ativas */}
        {temPromocoes && (
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
        )}

        {/* Produtos */}
        {temProdutos && (
          <div>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5" style={{ color: GRAFITE }}><Tag className="w-4 h-4" /> Produtos</h2>
            <div className="grid grid-cols-2 gap-3">
              {parceiro.produtos.map((produto, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-3">
                  {produto.foto && <img src={produto.foto} alt={produto.nome} className="w-full h-24 object-cover rounded-lg mb-2" />}
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
          </div>
        )}
      </div>
    </div>
  );
}

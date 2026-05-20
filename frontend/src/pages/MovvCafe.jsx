import { useState, useEffect } from 'react';
import { Coffee, MapPin, ShoppingBag, Star, Leaf, Sparkles, Flame, Package, ZoomIn, X } from 'lucide-react';

const WA_BASE = 'https://wa.me/5564992917383';

const WA_UNIT_TRAD  = `${WA_BASE}?text=Ol%C3%A1!%20Tenho%20interesse%20em%20comprar%20o%20Caf%C3%A9%20de%20V%C3%B3%20Tradicional%20500g%20(moido)`;
const WA_BULK_TRAD  = `${WA_BASE}?text=Ol%C3%A1!%20Tenho%20interesse%20em%20comprar%20no%20ATACADO%20(acima%20de%2020kg)%20o%20Caf%C3%A9%20de%20V%C3%B3%20Tradicional`;
const WA_GOURMET    = `${WA_BASE}?text=Ol%C3%A1!%20Tenho%20interesse%20em%20comprar%20o%20Caf%C3%A9%20de%20V%C3%B3%20Gourmet%20500g%20(em%20graos)`;
const WA_CONTACT    = `${WA_BASE}?text=Ol%C3%A1!%20Tenho%20interesse%20no%20Caf%C3%A9%20de%20V%C3%B3`;

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem ampliada"
      onClick={onClose}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 250ms ease' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-10"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ transform: visible ? 'scale(1)' : 'scale(0.94)', transition: 'transform 250ms ease' }}
        className="relative"
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar imagem"
          className="absolute -top-4 -right-4 z-10 w-10 h-10 rounded-full bg-stone-900 border border-white/20 flex items-center justify-center text-white hover:bg-amber-800 transition-colors shadow-xl"
        >
          <X className="w-5 h-5" />
        </button>

        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
        />

        <p className="text-center text-white/50 text-xs mt-3 select-none">
          {alt} · clique fora ou ESC para fechar
        </p>
      </div>
    </div>
  );
}

const badges = [
  { icon: <Leaf className="w-4 h-4" />,     label: '100% Arábica Selecionado' },
  { icon: <Sparkles className="w-4 h-4" />, label: 'Sem misturas, sem impurezas' },
  { icon: <MapPin className="w-4 h-4" />,   label: 'Origem: Patrocínio — Cerrado Mineiro' },
  { icon: <Flame className="w-4 h-4" />,    label: 'Torra média escura premium' },
];

export default function MovvCafe() {
  const [lightbox, setLightbox] = useState(null); // { src, alt }

  return (
    <>
    <div className="max-w-4xl mx-auto pb-12 space-y-10">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-amber-950 to-stone-800 shadow-2xl">
        {/* Textura decorativa */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #C9A84C 0%, transparent 50%), radial-gradient(circle at 80% 20%, #92400E 0%, transparent 40%)' }} />

        <div className="relative flex flex-col items-center text-center px-6 py-12 gap-5">
          {/* Logo */}
          <div className="w-36 h-36 rounded-full bg-white/10 backdrop-blur-sm border border-amber-400/30 flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src="/logo-cafe-de-vo.png"
              alt="Café de Vó"
              className="w-full h-full object-contain p-2"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
            <div className="hidden w-full h-full items-center justify-center">
              <Coffee className="w-16 h-16 text-amber-300" />
            </div>
          </div>

          {/* Títulos */}
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.3em] mb-1">Grupo Movv apresenta</p>
            <h1 className="text-white font-bold text-4xl sm:text-5xl tracking-tight">Movv Café</h1>
            <p className="text-amber-200 text-lg mt-2 font-medium italic">Café de Vó — Sabor que traz lembranças</p>
          </div>
        </div>
      </div>

      {/* ── Introdução ───────────────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-4">
          <Coffee className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <h2 className="font-bold text-stone-800 text-xl">Nossa História</h2>
        </div>
        <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
          No Café de Vó, acreditamos que café bom é café fresco de verdade. Por isso, nossos grãos passam
          por um processo cuidadoso de torra e moagem, chegando até você sempre fresquinhos, com aroma
          intenso e sabor marcante em cada xícara.
        </p>
        <p className="text-stone-700 text-sm sm:text-base leading-relaxed mt-3">
          Trabalhamos com café 100% selecionado, sem misturas e sem impurezas — qualidade que fazemos
          questão de garantir. Aqui, o compromisso é entregar um café puro, encorpado e cheio de tradição,
          daquele jeito que lembra café passado na casa da vó.
        </p>
        <p className="text-amber-800 font-semibold text-sm sm:text-base mt-4">
          Mais que café, entregamos carinho, sabor e confiança em cada pacote. ☕❤️
        </p>
      </div>

      {/* ── Badges de qualidade ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {badges.map((b, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-2 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
              {b.icon}
            </div>
            <p className="text-stone-700 text-xs font-medium leading-snug">{b.label}</p>
          </div>
        ))}
      </div>

      {/* ── Produtos ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-stone-800 font-bold text-2xl mb-5 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-amber-700" />
          Nossos Produtos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Card Tradicional */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-md flex flex-col">
            {/* Imagem */}
            <div
              className="h-52 bg-gradient-to-br from-stone-100 to-amber-100 flex items-center justify-center overflow-hidden relative group cursor-zoom-in"
              onClick={() => setLightbox({ src: '/cafe-tradicional.jpg', alt: 'Café de Vó Tradicional' })}
              role="button"
              tabIndex={0}
              aria-label="Ampliar imagem do Café Tradicional"
              onKeyDown={e => e.key === 'Enter' && setLightbox({ src: '/cafe-tradicional.jpg', alt: 'Café de Vó Tradicional' })}
            >
              <img
                src="/cafe-tradicional.jpg"
                alt="Café de Vó Tradicional"
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <div className="hidden w-full h-full items-center justify-center">
                <Coffee className="w-20 h-20 text-stone-400" />
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2.5">
                  <ZoomIn className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col flex-1 gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-lg">Café de Vó Tradicional</h3>
                <p className="text-amber-700 text-sm font-semibold">500g — Moído</p>
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">
                Café fresco com torra média escura. Aroma intenso e sabor marcante. Perfeito para o seu café da manhã.
              </p>

              {/* Preço */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-stone-900">R$ 32,90</span>
                <span className="text-stone-400 text-sm">/ unidade</span>
              </div>

              {/* Box atacado */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <p className="text-amber-800 text-xs font-semibold">
                  📦 ATACADO (+20 kg): <span className="text-base font-bold">R$ 25,00</span>/unidade
                </p>
              </div>

              {/* Botões */}
              <div className="flex flex-col gap-2 mt-auto pt-2">
                <a
                  href={WA_UNIT_TRAD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  💬 Comprar Unidade via WhatsApp
                </a>
                <a
                  href={WA_BULK_TRAD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  📦 Comprar Atacado
                </a>
              </div>
            </div>
          </div>

          {/* Card Gourmet */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-md flex flex-col">
            {/* Imagem */}
            <div
              className="h-52 bg-gradient-to-br from-stone-200 to-stone-100 flex items-center justify-center overflow-hidden relative group cursor-zoom-in"
              onClick={() => setLightbox({ src: '/cafe-gourmet.jpg', alt: 'Café de Vó Gourmet' })}
              role="button"
              tabIndex={0}
              aria-label="Ampliar imagem do Café Gourmet"
              onKeyDown={e => e.key === 'Enter' && setLightbox({ src: '/cafe-gourmet.jpg', alt: 'Café de Vó Gourmet' })}
            >
              <img
                src="/cafe-gourmet.jpg"
                alt="Café de Vó Gourmet"
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <div className="hidden w-full h-full items-center justify-center">
                <Coffee className="w-20 h-20 text-stone-400" />
              </div>
              {/* Selo premium */}
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow z-10">
                <Star className="w-3 h-3" /> Premium
              </span>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2.5">
                  <ZoomIn className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col flex-1 gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-lg">Café de Vó Gourmet</h3>
                <p className="text-amber-700 text-sm font-semibold">500g — Em Grãos</p>
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">
                Café especial em grãos para quem aprecia o melhor. Ideal para máquinas espresso e moinhos profissionais.
              </p>

              {/* Preço */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-stone-900">R$ 47,00</span>
                <span className="text-stone-400 text-sm">/ unidade</span>
              </div>

              {/* Destaque gourmet */}
              <div className="bg-gradient-to-r from-stone-50 to-amber-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-stone-700 text-xs font-semibold">
                  Grãos selecionados — torra artesanal de alta qualidade
                </p>
              </div>

              {/* Botão */}
              <div className="mt-auto pt-2">
                <a
                  href={WA_GOURMET}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-full"
                >
                  💬 Comprar via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onde Encontrar ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-stone-800 font-bold text-2xl mb-5 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-amber-700" />
          Onde Encontrar
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* WhatsApp */}
          <div className="bg-white border border-green-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
              📲
            </div>
            <div>
              <p className="font-bold text-stone-800">WhatsApp</p>
              <p className="text-stone-500 text-sm mt-0.5">(64) 99291-7383</p>
            </div>
            <a
              href={WA_CONTACT}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Falar com a gente
            </a>
          </div>

          {/* Loja física */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
              🏠
            </div>
            <div>
              <p className="font-bold text-stone-800">Nossa Loja</p>
              <p className="text-stone-500 text-sm mt-0.5 leading-snug">
                Av. Washington Luiz, 125<br />
                Itumbiara — GO
              </p>
            </div>
          </div>

          {/* Pontos de venda */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-2xl">
              🛒
            </div>
            <div>
              <p className="font-bold text-stone-800">Pontos Autorizados</p>
              <div className="text-stone-500 text-sm mt-1 space-y-0.5">
                <p>Supermercado IGM</p>
                <p>Supermercado Gerlu</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer da seção ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-stone-900 to-amber-950 rounded-2xl p-6 text-center shadow-lg">
        <Coffee className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-white font-semibold text-lg leading-relaxed">
          Mais que café, entregamos carinho, sabor e confiança em cada pacote.
        </p>
        <p className="text-amber-300 text-2xl mt-2">☕❤️</p>
        <p className="text-stone-400 text-xs mt-4">
          Café de Vó — uma marca do Grupo Movv • Itumbiara, GO
        </p>
      </div>

    </div>
    {lightbox && (
      <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
    )}
  </>
  );
}

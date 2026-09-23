import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { otimizarCloudinary } from '../../../../../utils/cloudinary';
import { DOURADO } from '../../theme';

// Proporção das peças (22/09): desktop 2172x724 (3:1), mobile 1254x1254
// (1:1 — o gerador devolveu quadrado em vez de 4:3). A altura do slide
// segue essas proporções (ver ALTURA_BANNER_ARTE em HeroBannerCarousel),
// então a arte aparece inteira, sem barra e praticamente sem corte. Se
// trocar de peça com outra proporção, ajustar aqui E lá.
export const ASPECT_RATIO_MOBILE = 1;
export const ASPECT_RATIO_DESKTOP = 3;

// Molde do slide do Fecha Mês: arte do Cloudinary no fundo, texto e botão
// em HTML por cima (dá pra trocar texto sem gerar arte nova). As 3 peças
// foram geradas com o mesmo espaço livre: faixa roxa lisa na ESQUERDA
// (~40% da largura) no desktop e na METADE DE BAIXO no mobile — o overlay
// mora nessas faixas. Fonte em cqw (relativa à largura do slide) pra
// crescer junto com a arte em vez de ficar fixa em px.
// `aoClicar` é pra destino que não é rota (ex.: rolar até âncora da home);
// senão navega pra `rota`.
export default function SlideBannerArteBase({ imagemDesktop, imagemMobile, alt, titulo, subtitulo, botao, rota, aoClicar }) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full overflow-hidden bg-iub-roxo-escuro" style={{ containerType: 'inline-size' }}>
      <picture>
        <source media="(max-width: 639px)" srcSet={otimizarCloudinary(imagemMobile)} />
        <img
          src={otimizarCloudinary(imagemDesktop)}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>

      {/* <640px: faixa de baixo, centralizado, parando acima dos dots do
          carrossel. >=640px: coluna da esquerda, centralizado na vertical. */}
      <div className="banner-arte-texto absolute flex flex-col items-center text-center sm:items-start sm:text-left">
        <h2 className="banner-arte-titulo font-black text-white leading-[1.05] tracking-tight" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 3px 14px rgba(0,0,0,0.45)' }}>
          {titulo}
        </h2>
        <p className="banner-arte-subtitulo font-semibold text-white/90 mt-[0.35em]" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}>
          {subtitulo}
        </p>
        <button
          type="button"
          onClick={() => (aoClicar ? aoClicar(navigate) : navigate(rota))}
          className="banner-arte-botao inline-flex items-center gap-[0.5em] w-fit font-black rounded-2xl hover:scale-[1.03] transition-transform"
          style={{ backgroundColor: DOURADO, color: '#0F0F14', boxShadow: '0 8px 24px rgba(255,184,0,0.35)' }}
        >
          {botao} <ArrowRight weight="bold" className="w-[1.1em] h-[1.1em]" />
        </button>
      </div>

      <style>{`
        /* Mobile: título em 1 linha (cabe até em 320px) pra o bloco
           inteiro ficar abaixo do tênis do Roxinho (~63% da peça). */
        .banner-arte-texto { left: 6%; right: 6%; bottom: 9.5%; }
        .banner-arte-titulo { font-size: clamp(18px, 5.8cqw, 30px); }
        .banner-arte-subtitulo { font-size: clamp(12px, 3.7cqw, 18px); }
        .banner-arte-botao { font-size: clamp(12px, 3.6cqw, 16px); padding: 0.7em 1.5em; margin-top: 0.75em; }
        @media (min-width: 640px) {
          /* max(…, 80px): em tablet 5.5% cai embaixo da seta "anterior"
             do carrossel (48px + 20px de margem). */
          .banner-arte-texto { left: max(5.5%, 80px); right: auto; bottom: auto; top: 50%; transform: translateY(-50%); width: 38%; }
          .banner-arte-titulo { font-size: clamp(22px, 3.4cqw, 64px); }
          .banner-arte-subtitulo { font-size: clamp(12px, 1.7cqw, 30px); }
          .banner-arte-botao { font-size: clamp(12px, 1.25cqw, 20px); margin-top: 1.4em; }
        }
      `}</style>
    </div>
  );
}

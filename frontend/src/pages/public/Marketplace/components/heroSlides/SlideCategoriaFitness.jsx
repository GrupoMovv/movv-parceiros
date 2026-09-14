import SlideCategoriaOficialBase from './SlideCategoriaOficialBase';

// Slide 5 do redesign — só aparece no carrossel (ver HeroBannerCarousel)
// se `lojas` vier com pelo menos 1 parceiro Master de Fitness & Esporte
// (GET /public/parceiros/master-por-categoria).
export default function SlideCategoriaFitness({ lojas }) {
  return (
    <SlideCategoriaOficialBase
      emoji="🏋️"
      subtitulo="Fitness & Esporte"
      categoriaSlug="fitness"
      gradiente="linear-gradient(120deg, #C2410C 0%, #F97316 45%, #7C3AED 135%)"
      lojas={lojas}
    />
  );
}

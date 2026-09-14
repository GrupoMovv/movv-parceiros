import SlideCategoriaOficialBase from './SlideCategoriaOficialBase';

// Slide 3 do redesign — só aparece no carrossel (ver HeroBannerCarousel)
// se `lojas` vier com pelo menos 1 parceiro Master de Beleza & Estética
// (GET /public/parceiros/master-por-categoria).
export default function SlideCategoriaBeleza({ lojas }) {
  return (
    <SlideCategoriaOficialBase
      emoji="🌸"
      subtitulo="Beleza & Estética"
      categoriaSlug="beleza"
      gradiente="linear-gradient(120deg, #9D174D 0%, #EC4899 55%, #FFB800 130%)"
      lojas={lojas}
    />
  );
}

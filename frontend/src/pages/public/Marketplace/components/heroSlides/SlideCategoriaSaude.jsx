import SlideCategoriaOficialBase from './SlideCategoriaOficialBase';

// Slide 4 do redesign — só aparece no carrossel (ver HeroBannerCarousel)
// se `lojas` vier com pelo menos 1 parceiro Master de Saúde & Farmácia
// (GET /public/parceiros/master-por-categoria).
export default function SlideCategoriaSaude({ lojas }) {
  return (
    <SlideCategoriaOficialBase
      emoji="💊"
      subtitulo="Saúde & Farmácia"
      categoriaSlug="saude"
      gradiente="linear-gradient(115deg, #047857 0%, #10B981 55%, #ECFDF5 135%)"
      lojas={lojas}
    />
  );
}

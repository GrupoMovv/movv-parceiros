import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 1 — hero institucional (Roxinho com as sacolas). Não existe página
// /marketplace/produtos ainda (ver TopNav/TODO.md), então "Explorar" faz o
// mesmo que o "📦 Produtos" do menu: rola até a faixa de categorias da
// home — o carrossel só vive em /marketplace, então é aqui mesmo.
function explorarProdutos(navigate) {
  navigate('/marketplace');
  setTimeout(() => document.querySelector('#categorias')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

export default function SlideHero() {
  return (
    <SlideBannerArteBase
      imagemDesktop="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107588/hero-desktop.png"
      imagemMobile="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107589/hero-mobile.png"
      alt="Roxinho do IUB MAIS+ carregando sacolas de compras pela cidade"
      titulo="Marketplace de Itumbiara"
      subtitulo="Mais qualidade. Mais confiança."
      botao="Explorar"
      aoClicar={explorarProdutos}
    />
  );
}

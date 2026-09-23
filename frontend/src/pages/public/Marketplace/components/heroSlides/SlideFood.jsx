import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 4 — divulgação do IUB Food (/marketplace/food). Fixo igual
// Hero/Jogos/Serviços, não depende de dado nenhum do backend.
export default function SlideFood() {
  return (
    <SlideBannerArteBase
      imagemDesktop="https://res.cloudinary.com/emv2nb1j/image/upload/v1790171646/food-desktop.png"
      imagemMobile="https://res.cloudinary.com/emv2nb1j/image/upload/v1790171646/food-mobile.png"
      alt="Roxinho do IUB MAIS+ servindo hambúrguer, pizza, sushi e açaí, com entregador de moto"
      titulo="IUB FOOD"
      subtitulo="Peça sua comida favorita"
      botao="Pedir agora"
      rota="/marketplace/food"
    />
  );
}

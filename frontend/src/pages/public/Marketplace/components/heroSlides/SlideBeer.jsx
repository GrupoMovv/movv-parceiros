import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 5 — divulgação do IUB BEER (/beer, área +18 com verificação de
// idade na entrada). Fixo igual Hero/Jogos/Serviços/Food.
export default function SlideBeer() {
  return (
    <SlideBannerArteBase
      imagemDesktop="https://res.cloudinary.com/emv2nb1j/image/upload/v1790187628/beer-desktop.png"
      imagemMobile="https://res.cloudinary.com/emv2nb1j/image/upload/v1790187628/beer-mobile.png"
      alt="Roxinho Gentleman do IUB MAIS+, de bigode e gravata-borboleta, brindando num bar"
      titulo="Bora tomar uma?"
      subtitulo="Sua bebida gelada em minutos"
      botao="Pedir agora"
      rota="/beer"
    />
  );
}

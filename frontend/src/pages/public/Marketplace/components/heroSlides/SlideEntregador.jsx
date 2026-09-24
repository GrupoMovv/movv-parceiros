import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 6 — pré-cadastro do IUB+ ENTREGADORES (/entregadores, "em breve").
// Fixo igual Hero/Jogos/Serviços/Food/Beer; as mesmas peças são o banner
// do topo da própria página (ver Entregadores.jsx).
export const IMAGEM_ENTREGADOR_DESKTOP = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1790273699/entregador-desktop.png';
export const IMAGEM_ENTREGADOR_MOBILE = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1790273699/entregador-mobile.png';

export default function SlideEntregador() {
  return (
    <SlideBannerArteBase
      imagemDesktop={IMAGEM_ENTREGADOR_DESKTOP}
      imagemMobile={IMAGEM_ENTREGADOR_MOBILE}
      alt="Motoboy do IUB MAIS+ pronto pra entregar em Itumbiara"
      titulo="🛵 Motoboy?"
      subtitulo="Chegou sua vez em Itumbiara"
      botao="Reservar meu lugar"
      rota="/entregadores"
    />
  );
}

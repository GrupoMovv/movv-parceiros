import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 2 — chama pro hub de joguinhos (/jogar: Roleta + Memória).
export default function SlideJogos() {
  return (
    <SlideBannerArteBase
      imagemDesktop="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107590/jogos-desktop.png"
      imagemMobile="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107588/jogos-mobile.png"
      alt="Roxinho do IUB MAIS+ com controle de videogame, roleta e baú de moedas"
      titulo="JOGA E GANHA!"
      subtitulo="Cupons e prêmios todos os dias"
      botao="Jogar agora"
      rota="/jogar"
    />
  );
}

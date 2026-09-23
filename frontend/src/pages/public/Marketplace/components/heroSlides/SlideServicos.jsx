import SlideBannerArteBase from './SlideBannerArteBase';

// Slide 3 — divulgação do /marketplace/servicos. Fixo igual Hero/Jogos,
// não depende de dado nenhum do backend.
export default function SlideServicos() {
  return (
    <SlideBannerArteBase
      imagemDesktop="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107588/servicos-desktop.png"
      imagemMobile="https://res.cloudinary.com/emv2nb1j/image/upload/v1790107588/servicos-mobile.png"
      alt="Roxinho do IUB MAIS+ mostrando profissionais de serviços num tablet, com WhatsApp"
      titulo="Serviços de Qualidade"
      subtitulo="Agende direto pelo WhatsApp"
      botao="Ver profissionais"
      rota="/marketplace/servicos"
    />
  );
}

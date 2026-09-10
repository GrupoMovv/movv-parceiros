import { useNavigate } from 'react-router-dom';
import MascoteIubMais from '../../../../../components/MascoteIubMais';

// Slide promocional da Roleta da Sorte (IUB MAIS+ Joguinhos, fase 1) — só
// entra no carrossel pra quem já está logado como associado (ver
// HeroBannerCarousel: `associado && { id: 'roleta', ... }`), porque girar
// exige sessão (authenticatePainelPublico no backend).
export default function SlideRoleta() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex items-center overflow-hidden bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro">
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[60%]">
        <h2 className="font-black text-xl sm:text-3xl lg:text-4xl tracking-tight leading-tight text-white">
          🎡 Gire a roleta e ganhe cupom!
        </h2>
        <p className="text-sm sm:text-base font-semibold mt-2 text-iub-dourado">
          O joguinho que você nunca perde!
        </p>
        <p className="text-xs sm:text-sm mt-1 hidden sm:block text-white/75">
          1 giro por dia, sempre sai um cupom de desconto com um parceiro IUB MAIS+.
        </p>
        <button
          type="button"
          onClick={() => navigate('/jogar/roleta')}
          className="btn-iub-dourado w-fit mt-4 sm:mt-6 text-xs sm:text-sm px-5 sm:px-6 py-2.5 sm:py-3.5"
        >
          Jogar agora
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-center justify-center">
        <MascoteIubMais tamanho="large" animacao="float" />
      </div>
    </div>
  );
}

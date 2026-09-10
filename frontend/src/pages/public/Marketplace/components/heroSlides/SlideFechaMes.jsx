import { useNavigate } from 'react-router-dom';

// Banner oficial gerado pra cada edição do Fecha Mês — data e contagem de
// dias já vêm desenhadas na arte (ver `info.data_evento`/`dias_restantes`
// pro cálculo real, mostrado em texto em FechaMesBanner). Trocar essa URL
// a cada novo evento, quando a peça for regerada.
const SLIDE_FECHA_MES = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788983002/ChatGPT_Image_9_de_set._de_2026_16_18_38.png';

// Slide promocional do Fecha Mês — só entra no carrossel (ver
// HeroBannerCarousel) quando faltam <= 20 dias pro evento; no dia em si
// quem assume é o FechaMesBanner (topo da home), não este slide.
export default function SlideFechaMes({ info }) {
  const navigate = useNavigate();

  function verProdutos() {
    navigate('/marketplace');
    setTimeout(() => document.querySelector('#fecha-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  return (
    <div className="slide-fecha-mes relative w-full h-full overflow-hidden bg-iub-roxo-escuro">
      <img
        src={SLIDE_FECHA_MES}
        alt={`Fecha Mês IUB MAIS+ — faltam ${info.dias_restantes} ${info.dias_restantes === 1 ? 'dia' : 'dias'}`}
        loading="lazy"
        className="w-full h-full object-cover"
      />

      <div className="absolute bottom-4 md:bottom-8 left-4 md:left-8">
        <button
          type="button"
          onClick={verProdutos}
          className="btn-iub-dourado inline-flex items-center gap-2 text-xs sm:text-base px-4 sm:px-6 py-2 sm:py-3"
        >
          VER PRODUTOS →
        </button>
      </div>
    </div>
  );
}

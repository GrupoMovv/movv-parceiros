import { useNavigate } from 'react-router-dom';

// Peça atual — tem "25 DE SETEMBRO" e "Faltam 16 dias" DESENHADOS na
// imagem (fica desatualizada a cada dia e precisa ser regerada a cada
// edição do Fecha Mês). Usada como está enquanto SLIDE_FECHA_MES_SEM_TEXTO
// (abaixo) não for preenchida.
const SLIDE_FECHA_MES_COM_TEXTO = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788983002/ChatGPT_Image_9_de_set._de_2026_16_18_38.png';

// TODO(Junior): colar aqui a URL da versão da arte SEM "25 DE SETEMBRO" e
// sem "Faltam 16 dias" — mantendo o resto igual (mascote, "FECHA MÊS ESTÁ
// CHEGANDO!", 50%, pílula "APENAS 24 HORAS", ícones de categoria etc).
// Assim que preencher, o slide troca sozinho pra usar o overlay dinâmico
// (data e contagem calculadas de verdade a partir de `info`, nunca ficam
// desatualizadas) — nenhuma outra mudança de código é necessária.
const SLIDE_FECHA_MES_SEM_TEXTO = null;

// Proporção da peça oficial (2172x724). O frame abaixo trava nessa
// proporção e centraliza dentro do slide — garante que (a) a arte nunca
// corta nas laterais em telas estreitas (bug preexistente do object-cover
// puro: no mobile ele cortava ~25% de cada lado, escondendo bem a coluna
// de texto da direita) e (b) as posições em % do overlay batem exatamente
// com a imagem em qualquer largura de tela, sem precisar medir nada via JS.
const ASPECT_RATIO = '2172 / 724';

function formatarDataDestaque(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  return `${dia} DE ${mes}`;
}

// Posições calibradas visualmente em cima da peça atual (2172x724), coluna
// de texto do lado direito, embaixo do "50%" e da pílula "APENAS 24
// HORAS". Se a arte nova mudar esse layout, recalibrar left/top/fontSize.
const OVERLAY_DATA = { left: '72%', top: '58.5%', width: '22%', fontSizeCqw: 1.9 };
const OVERLAY_DIAS = { left: '72%', top: '68%', width: '22%', fontSizeCqw: 1.6 };

// Slide promocional do Fecha Mês — só entra no carrossel (ver
// HeroBannerCarousel) quando faltam <= 20 dias pro evento; no dia em si
// quem assume é o FechaMesBanner (topo da home), não este slide.
export default function SlideFechaMes({ info }) {
  const navigate = useNavigate();

  const usaOverlayDinamico = Boolean(SLIDE_FECHA_MES_SEM_TEXTO);
  const imagemSlide = usaOverlayDinamico ? SLIDE_FECHA_MES_SEM_TEXTO : SLIDE_FECHA_MES_COM_TEXTO;
  const textoDias = `Faltam ${info.dias_restantes} ${info.dias_restantes === 1 ? 'dia' : 'dias'}`;

  function verProdutos() {
    navigate('/marketplace');
    setTimeout(() => document.querySelector('#fecha-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  return (
    <div className="slide-fecha-mes relative w-full h-full overflow-hidden bg-iub-roxo-escuro flex items-center">
      <div
        className="relative w-full"
        style={{ aspectRatio: ASPECT_RATIO, containerType: 'inline-size' }}
      >
        <img
          src={imagemSlide}
          alt={`Fecha Mês IUB MAIS+ — ${formatarDataDestaque(info.data_evento)}, ${textoDias}`}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {usaOverlayDinamico && (
          <>
            <p
              className="absolute font-black text-white uppercase leading-none"
              style={{
                left: OVERLAY_DATA.left, top: OVERLAY_DATA.top, width: OVERLAY_DATA.width,
                fontSize: `clamp(9px, ${OVERLAY_DATA.fontSizeCqw}cqw, 26px)`,
                textShadow: '0 2px 6px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.85)',
              }}
            >
              📅 {formatarDataDestaque(info.data_evento)}
            </p>
            <p
              className="absolute font-bold text-white leading-none"
              style={{
                left: OVERLAY_DIAS.left, top: OVERLAY_DIAS.top, width: OVERLAY_DIAS.width,
                fontSize: `clamp(8px, ${OVERLAY_DIAS.fontSizeCqw}cqw, 20px)`,
                textShadow: '0 2px 6px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.85)',
              }}
            >
              🕐 {textoDias}
            </p>
          </>
        )}
      </div>

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

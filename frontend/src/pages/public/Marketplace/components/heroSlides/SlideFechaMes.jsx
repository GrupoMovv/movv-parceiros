import { useNavigate } from 'react-router-dom';

// Peça antiga — tinha "25 DE SETEMBRO" e "Faltam 16 dias" DESENHADOS na
// imagem. Mantida só como fallback caso SLIDE_FECHA_MES_SEM_TEXTO (abaixo)
// volte a ficar vazia por algum motivo.
const SLIDE_FECHA_MES_COM_TEXTO = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788983002/ChatGPT_Image_9_de_set._de_2026_16_18_38.png';

// Peça nova (10/09) — layout diferente da antiga: em vez de uma coluna de
// texto do lado direito, tem duas "pílulas" com ícone (calendário/relógio)
// e espaço em branco reservado do lado do ícone pra entrar texto. Data e
// contagem são calculadas de verdade a partir de `info` (nunca ficam
// desatualizadas como a peça antiga ficava).
const SLIDE_FECHA_MES_SEM_TEXTO = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789048827/ChatGPT_Image_10_de_set._de_2026_11_00_00.png';

// Proporção da peça ativa no momento — trava o frame nessa proporção e
// centraliza dentro do slide: garante que (a) a arte nunca corta nas
// laterais em telas estreitas (bug do object-cover puro: no mobile
// chegava a cortar ~25% de cada lado) e (b) as posições em % do overlay
// batem exatamente com a imagem em qualquer largura de tela, sem precisar
// medir nada via JS. Peça antiga era 2172x724; a nova é 2170x725 (basicamente
// igual) — se trocar de peça de novo, conferir e ajustar aqui.
const ASPECT_RATIO = '2170 / 725';

function formatarDataDestaque(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  return `${dia} DE ${mes}`;
}

// Versão curta pra caber no espaço em branco da pílula (~105-125px de
// largura útil numa imagem de 2170px, ao lado do ícone — não cabe "25 DE
// SETEMBRO" por extenso). Ex.: "25 SET".
function formatarDataCompacta(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  return `${dia} ${mes}`;
}

// Posições calibradas em cima da peça nova (2170x725) via crops no
// Cloudinary pra achar as coordenadas exatas das duas pílulas vazias
// (uma com ícone de calendário, outra com ícone de relógio, lado a lado,
// logo abaixo de "FECHA MÊS ESTÁ CHEGANDO!"). Cada zona aqui é só o
// espaço em branco AO LADO do ícone (o ícone já vem desenhado na peça,
// não precisa repetir 📅/🕐 no overlay). Ajustar aqui se o layout da arte
// mudar numa próxima geração.
const OVERLAY_DATA = { left: '47.5%', top: '66.5%', width: '7%', height: '10%', fontSizeCqw: 1.5 };
const OVERLAY_DIAS = { left: '56%', top: '66.5%', width: '7.5%', height: '10%', fontSizeCqw: 1.3 };

// Slide promocional do Fecha Mês — só entra no carrossel (ver
// HeroBannerCarousel) quando faltam <= 20 dias pro evento; no dia em si
// quem assume é o FechaMesBanner (topo da home), não este slide.
export default function SlideFechaMes({ info }) {
  const navigate = useNavigate();

  const usaOverlayDinamico = Boolean(SLIDE_FECHA_MES_SEM_TEXTO);
  const imagemSlide = usaOverlayDinamico ? SLIDE_FECHA_MES_SEM_TEXTO : SLIDE_FECHA_MES_COM_TEXTO;
  const textoDias = `${info.dias_restantes} ${info.dias_restantes === 1 ? 'dia' : 'dias'}`;

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
          alt={`Fecha Mês IUB MAIS+ — ${formatarDataDestaque(info.data_evento)}, faltam ${textoDias}`}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {usaOverlayDinamico && (
          <>
            <div
              className="absolute flex items-center justify-start font-black text-white uppercase leading-none whitespace-nowrap"
              style={{
                left: OVERLAY_DATA.left, top: OVERLAY_DATA.top, width: OVERLAY_DATA.width, height: OVERLAY_DATA.height,
                fontSize: `clamp(8px, ${OVERLAY_DATA.fontSizeCqw}cqw, 22px)`,
                textShadow: '0 2px 6px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)',
              }}
            >
              {formatarDataCompacta(info.data_evento)}
            </div>
            <div
              className="absolute flex items-center justify-start font-bold text-white leading-none whitespace-nowrap"
              style={{
                left: OVERLAY_DIAS.left, top: OVERLAY_DIAS.top, width: OVERLAY_DIAS.width, height: OVERLAY_DIAS.height,
                fontSize: `clamp(7px, ${OVERLAY_DIAS.fontSizeCqw}cqw, 18px)`,
                textShadow: '0 2px 6px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)',
              }}
            >
              {textoDias}
            </div>
          </>
        )}
      </div>

      {/* Botão ancorado no container FIXO (não no frame da imagem) —
          na maioria das larguras reais (mobile inteiro; desktop até ~1850px
          de container) o frame não preenche a altura toda, sobra barra roxo-
          escuro embaixo e o botão cai limpo ali, sem tocar a arte. Só em
          monitor bem largo (≳1920px) o frame preenche 100% da altura e o
          botão passa a ficar por cima do canto inferior esquerdo — que na
          peça nova tem o mascote + sacolas "COMPRE LOCAL" (mais cheio que a
          peça antiga). Conferir nesse caso específico; se incomodar, é só
          mover pra outro canto. */}
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

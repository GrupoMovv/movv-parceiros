import { useNavigate } from 'react-router-dom';
import { otimizarCloudinary } from '../../../../../utils/cloudinary';

// Peça antiga — tinha "25 DE SETEMBRO" e "Faltam 16 dias" DESENHADOS na
// imagem. Mantida só como fallback caso SLIDE_FECHA_MES_SEM_TEXTO (abaixo)
// volte a ficar vazia por algum motivo.
const SLIDE_FECHA_MES_COM_TEXTO = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788983002/ChatGPT_Image_9_de_set._de_2026_16_18_38.png';

// Peça nova (10/09) — layout diferente da antiga: em vez de uma coluna de
// texto do lado direito, tem duas "pílulas" com ícone (calendário/relógio)
// e espaço em branco reservado do lado do ícone pra entrar texto. Data e
// contagem são calculadas de verdade a partir de `info` (nunca ficam
// desatualizadas como a peça antiga ficava). Só entra no <picture> em
// >=640px — ver SLIDE_FECHA_MES_MOBILE pro que aparece abaixo disso.
const SLIDE_FECHA_MES_SEM_TEXTO = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789048827/ChatGPT_Image_10_de_set._de_2026_11_00_00.png';

// Peça vertical dedicada pro mobile (14/09, 1080x1080 quadrada) — layout
// TOTALMENTE diferente da horizontal, não é só um recorte dela: já vem
// com um botão "VER PRODUTOS" desenhado (decorativo, não clicável — o
// botão de verdade continua sendo o React logo abaixo) e a área de
// calendário/relógio aqui não tem espaço reservado pra texto do jeito
// que a horizontal tem (ícones colados, sem "slot" em branco do lado).
// Por isso o overlay dinâmico (OVERLAY_DATA/OVERLAY_DIAS) só aparece em
// >=640px — tentar reusar as mesmas coordenadas nessa peça ia colocar a
// data em cima de algum elemento aleatório do desenho, sem calibrar de
// verdade pra essa arte especificamente.
const SLIDE_FECHA_MES_MOBILE = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789412016/ChatGPT_Image_14_de_set._de_2026_11_17_08.png';

// Proporção da peça ativa em CADA breakpoint — trava o frame nessa
// proporção (nunca distorce). As posições em % do overlay (só ativo em
// >=640px) batem exatamente com a peça horizontal nessa faixa. Peça
// antiga (COM_TEXTO) era 2172x724; a SEM_TEXTO é 2170x725 (basicamente
// igual) — se trocar de peça de novo, conferir e ajustar aqui.
const ASPECT_RATIO_MOBILE = '1 / 1';
const ASPECT_RATIO_DESKTOP = '2170 / 725';

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
    <div className="slide-fecha-mes relative w-full h-full overflow-hidden bg-iub-roxo-escuro">
      <div
        className="fecha-mes-frame absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ containerType: 'inline-size' }}
      >
        <picture>
          <source media="(max-width: 639px)" srcSet={otimizarCloudinary(SLIDE_FECHA_MES_MOBILE)} />
          <img
            src={otimizarCloudinary(imagemSlide)}
            alt={`Fecha Mês IUB MAIS+ — ${formatarDataDestaque(info.data_evento)}, faltam ${textoDias}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </picture>

        {/* Só em >=640px — ver comentário de SLIDE_FECHA_MES_MOBILE sobre
            por que o overlay não é aplicado na peça quadrada. */}
        {usaOverlayDinamico && (
          <>
            <div
              className="hidden sm:flex absolute items-center justify-start font-black text-white uppercase leading-none whitespace-nowrap"
              style={{
                left: OVERLAY_DATA.left, top: OVERLAY_DATA.top, width: OVERLAY_DATA.width, height: OVERLAY_DATA.height,
                fontSize: `clamp(8px, ${OVERLAY_DATA.fontSizeCqw}cqw, 22px)`,
                textShadow: '0 2px 6px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)',
              }}
            >
              {formatarDataCompacta(info.data_evento)}
            </div>
            <div
              className="hidden sm:flex absolute items-center justify-start font-bold text-white leading-none whitespace-nowrap"
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

      {/* Botão ancorado no container FIXO (não no frame da imagem).
          <640px: o frame quadrado agora preenche quase 100% do slide
          (largura = tela, altura quase igual ao slide de 380px) — o
          botão (bottom-4 left-4) cai por cima do canto inferior esquerdo
          da arte (onde a peça mobile tem os ícones "Produtos/Serviços/
          Ofertas/Empresas"). Fundo sólido dourado, continua legível e
          clicável em cima de qualquer coisa, só fica visualmente mais
          "em cima" da arte do que antes. >=640px: comportamento de
          sempre — na maioria das larguras (até ~1850px de container)
          sobra barra embaixo e o botão cai limpo ali; só em monitor bem
          largo (≳1920px) o frame preenche 100% da altura e o botão passa
          a ficar por cima do canto inferior esquerdo (mascote + sacolas
          "COMPRE LOCAL"). Se incomodar em algum desses casos, é só mover
          pra outro canto.
          Posição separa o botão dos controles do carrossel (play/pause
          no canto inferior esquerdo, dots no centro, ver
          HeroBannerCarousel): <768px sobe acima dessa linha (bottom-12/
          sm:bottom-16), porque de lado ia bater nos dots; >=768px fica
          na altura de sempre e só anda pra direita do play (md:left-20). */}
      <div className="absolute bottom-12 sm:bottom-16 md:bottom-8 left-4 md:left-20">
        <button
          type="button"
          onClick={verProdutos}
          className="btn-iub-dourado inline-flex items-center gap-2 text-xs sm:text-base px-4 sm:px-6 py-2 sm:py-3"
        >
          VER PRODUTOS →
        </button>
      </div>

      <style>{`
        /* width:100%/height:auto vale pros dois breakpoints — só o
           aspect-ratio muda. <640px: peça quadrada (1:1) dimensiona pela
           LARGURA da tela (não mais pela altura — isso deixava sobrar
           barra roxa grande dos lados com o slide ainda em 250px de
           altura). Agora o slide no mobile tem 380px (ver
           HeroBannerCarousel/ALTURA_FECHA_MES) — largura ~320-414px vira
           frame de ~320-414px de altura, preenchendo 84-100% do slide
           (só corta ~17px de cada lado em 414px, cortado pelo
           overflow-hidden do container — imperceptível). >=640px: peça
           horizontal, comportamento idêntico ao de sempre. */
        .fecha-mes-frame { width: 100%; height: auto; aspect-ratio: ${ASPECT_RATIO_MOBILE}; }
        @media (min-width: 640px) {
          .fecha-mes-frame { aspect-ratio: ${ASPECT_RATIO_DESKTOP}; }
        }
      `}</style>
    </div>
  );
}

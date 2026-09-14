import { MASCOTE_URL } from '../../../../components/MascoteIubMais';

// Uma peça só (frente + verso) do grid — o flip 3D em si é CSS puro
// (.memoria-carta* em index.css). Conteúdo dimensionado em % da própria
// carta (não px fixo) porque o grid vai de 4x4 (cartas grandes) a 6x6
// (cartas bem pequenas no mobile) dependendo do nível — precisa escalar
// sozinho em vez de ter um tamanho por nível hardcoded.
export default function MemoriaCarta({ carta, virada, casada, onClick, desabilitada }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitada || virada || casada}
      aria-label={casada ? `Dupla encontrada: ${carta.nome || carta.id}` : 'Carta virada pra baixo'}
      className={`memoria-carta aspect-square w-full ${virada || casada ? 'memoria-carta-virada' : ''} disabled:cursor-default`}
    >
      <div className="memoria-carta-inner">
        <div className="memoria-carta-face rounded-lg sm:rounded-2xl bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro border-2 border-iub-roxo-neon/50 flex items-center justify-center shadow-lg">
          <img src={MASCOTE_URL} alt="" className="w-[45%] h-[45%] object-contain opacity-90" loading="lazy" />
        </div>
        <div
          className={`memoria-carta-face memoria-carta-frente rounded-lg sm:rounded-2xl bg-white border-2 flex items-center justify-center shadow-lg transition-colors ${
            casada ? 'border-emerald-400 ring-2 ring-emerald-300' : 'border-iub-dourado'
          }`}
          style={{ containerType: 'inline-size' }}
        >
          <CartaConteudo carta={carta} />
        </div>
      </div>
    </button>
  );
}

function CartaConteudo({ carta }) {
  if (carta.tipo === 'mascote') {
    return <img src={MASCOTE_URL} alt="Mascote IUB MAIS+" className="w-[55%] h-[55%] object-contain" loading="lazy" />;
  }
  if (carta.tipo === 'simbolo') {
    return <span style={{ fontSize: 'clamp(11px, 42cqw, 34px)', lineHeight: 1 }}>{carta.emoji}</span>;
  }
  if (carta.logo) {
    return <img src={carta.logo} alt={carta.nome} className="w-[55%] h-[55%] rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div
      className="w-[55%] h-[55%] rounded-full flex items-center justify-center text-white font-black"
      style={{ backgroundColor: carta.cor, fontSize: 'clamp(8px, 22cqw, 18px)' }}
    >
      {carta.sigla}
    </div>
  );
}

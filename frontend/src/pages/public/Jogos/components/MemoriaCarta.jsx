import { MASCOTE_URL } from '../../../../components/MascoteIubMais';

// Uma peça só (frente + verso) do grid 4x4 — o flip 3D em si é CSS puro
// (.memoria-carta* em index.css), aqui só decide o que mostrar em cada
// face conforme o estado (virada/casada) vindo do pai.
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
        <div className="memoria-carta-face rounded-xl sm:rounded-2xl bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro border-2 border-iub-roxo-neon/50 flex items-center justify-center shadow-lg">
          <img src={MASCOTE_URL} alt="" className="w-8 h-8 sm:w-11 sm:h-11 object-contain opacity-90" loading="lazy" />
        </div>
        <div
          className={`memoria-carta-face memoria-carta-frente rounded-xl sm:rounded-2xl bg-white border-2 flex items-center justify-center shadow-lg transition-colors ${
            casada ? 'border-emerald-400 ring-2 ring-emerald-300' : 'border-iub-dourado'
          }`}
        >
          <CartaConteudo carta={carta} />
        </div>
      </div>
    </button>
  );
}

function CartaConteudo({ carta }) {
  if (carta.tipo === 'mascote') {
    return <img src={MASCOTE_URL} alt="Mascote IUB MAIS+" className="w-10 h-10 sm:w-14 sm:h-14 object-contain" loading="lazy" />;
  }
  if (carta.tipo === 'simbolo') {
    return <span className="text-3xl sm:text-4xl">{carta.emoji}</span>;
  }
  if (carta.logo) {
    return <img src={carta.logo} alt={carta.nome} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div
      className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base"
      style={{ backgroundColor: carta.cor }}
    >
      {carta.sigla}
    </div>
  );
}

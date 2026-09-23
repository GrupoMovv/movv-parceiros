import { useEffect, useRef, useState } from 'react';
import { BEER } from '../../pages/beer/beerConfig';

// Modal +18 da entrada do IUB BEER (quem decide QUANDO mostrar é
// useAcessoBeer). "Continuar" só ativa com a caixinha marcada; "Cancelar"
// tira a pessoa da área (quem chama decide pra onde). Sem botão de fechar
// nem clique fora: fechar sem responder não pode liberar o conteúdo.
export default function ModalMaiorIdade({ onConfirmar, onCancelar }) {
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const checkboxRef = useRef(null);

  useEffect(() => { checkboxRef.current?.focus(); }, []);

  async function continuar() {
    if (!marcado || enviando) return;
    setEnviando(true);
    await onConfirmar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="beer-idade-titulo">
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 text-center"
        style={{ background: `linear-gradient(160deg, ${BEER.card} 0%, ${BEER.painel} 100%)`, border: `1px solid ${BEER.borda}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
      >
        <div className="text-5xl leading-none" aria-hidden="true">🍻</div>
        <h2 id="beer-idade-titulo" className="mt-4 text-2xl font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Bora tomar uma?
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: BEER.lavanda }}>
          Esta área contém bebidas alcoólicas.
          <br />
          Para continuar, confirme que você tem 18 anos ou mais.
        </p>

        <label className="mt-6 flex items-center gap-3 text-left cursor-pointer rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${BEER.borda}` }}>
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={marcado}
            onChange={e => setMarcado(e.target.checked)}
            className="w-5 h-5 rounded flex-shrink-0 accent-violet-500"
          />
          <span className="text-sm font-semibold text-white">Confirmo que sou maior de 18 anos</span>
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-colors hover:bg-white/10"
            style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={continuar}
            disabled={!marcado || enviando}
            className="flex-1 py-3 rounded-2xl text-sm font-black transition-opacity disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}
          >
            {enviando ? 'Entrando…' : 'Continuar'}
          </button>
        </div>

        <p className="mt-5 text-[11px]" style={{ color: 'rgba(196,181,253,0.6)' }}>
          Beba com responsabilidade. Se beber, não dirija.
        </p>
      </div>
    </div>
  );
}

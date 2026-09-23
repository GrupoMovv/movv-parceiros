import { CATEGORIAS_BEBIDA, BEER } from '../../pages/beer/beerConfig';

// Chips de categoria de bebida (lista fechada, ver beerConfig) com scroll
// horizontal no mobile. `ativa` null = "Todas".
export default function FiltroCategorias({ ativa, onSelecionar }) {
  const opcoes = [{ chave: null, label: 'Todas', emoji: '✨' }, ...CATEGORIAS_BEBIDA];
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      {opcoes.map(c => {
        const selecionada = ativa === c.chave;
        return (
          <button
            key={c.chave || 'todas'}
            type="button"
            onClick={() => onSelecionar(c.chave)}
            aria-pressed={selecionada}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-full transition-colors"
            style={selecionada
              ? { backgroundColor: BEER.violeta, color: '#fff', border: `1px solid ${BEER.violeta}` }
              : { backgroundColor: 'rgba(255,255,255,0.04)', color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        );
      })}
    </div>
  );
}

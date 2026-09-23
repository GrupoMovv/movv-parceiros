import { BEER } from '../../pages/beer/beerConfig';

// Chips de categoria (scroll horizontal no celular). `opcoes` =
// [{ codigo, nome, icone }] vindas de GET /public/beer/categorias; `ativa`
// null = "Todas".
export default function FiltroCategorias({ opcoes, ativa, onSelecionar, rotuloTodas = 'Todas' }) {
  const lista = [{ codigo: null, nome: rotuloTodas, icone: '✨' }, ...opcoes];
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      {lista.map(c => {
        const selecionada = ativa === c.codigo;
        return (
          <button
            key={c.codigo || 'todas'}
            type="button"
            onClick={() => onSelecionar(c.codigo)}
            aria-pressed={selecionada}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-full transition-colors"
            style={selecionada
              ? { backgroundColor: BEER.violeta, color: '#fff', border: `1px solid ${BEER.violeta}` }
              : { backgroundColor: 'rgba(255,255,255,0.04)', color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}
          >
            {c.icone && <span aria-hidden="true">{c.icone}</span>} {c.nome}
          </button>
        );
      })}
    </div>
  );
}

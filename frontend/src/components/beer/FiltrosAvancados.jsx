import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { BEER } from '../../pages/beer/beerConfig';
import { formatarBRL } from '../../utils/iubFood';

// Painel "🎯 Filtros" da tela de categoria. Celular: folha de baixo em tela
// cheia; desktop: gaveta à direita. Trabalha num RASCUNHO — só vale ao
// apertar "Aplicar" (a URL muda e a lista recarrega sem recarregar a
// página). `facetas` vêm do backend e só trazem opção que tem resultado
// nessa categoria: seção sem opção não aparece.
export default function FiltrosAvancados({ facetas, valores, onAplicar, onFechar }) {
  const [rascunho, setRascunho] = useState(valores);
  useEffect(() => {
    const aoTeclar = e => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const min = facetas.preco_min;
  const max = facetas.preco_max;
  const precoMin = rascunho.preco_min ?? min;
  const precoMax = rascunho.preco_max ?? max;
  const alterna = (campo, valor) => setRascunho(r => {
    const atual = new Set(r[campo] || []);
    if (atual.has(valor)) atual.delete(valor); else atual.add(valor);
    return { ...r, [campo]: [...atual] };
  });

  function aplicar() {
    // faixa inteira = sem filtro de preço (não suja a URL)
    onAplicar({
      ...rascunho,
      preco_min: precoMin > min ? precoMin : null,
      preco_max: precoMax < max ? precoMax : null,
    });
  }

  const temPreco = max > min;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Filtros">
      <div
        className="w-full sm:w-[400px] h-full flex flex-col"
        style={{ backgroundColor: BEER.card, borderLeft: `1px solid ${BEER.borda}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BEER.borda}` }}>
          <h2 className="text-lg font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>🎯 Filtros</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-2 rounded-lg hover:bg-white/10 text-white"><X size={20} weight="bold" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {temPreco && (
            <Secao titulo="Faixa de preço">
              <p className="text-sm font-bold text-white mb-3">{formatarBRL(precoMin)} — {formatarBRL(precoMax)}</p>
              <label className="block text-[11px] mb-1" style={{ color: BEER.lavandaFraca }}>Mínimo</label>
              <input type="range" min={min} max={max} step="1" value={precoMin} aria-label="Preço mínimo"
                onChange={e => setRascunho(r => ({ ...r, preco_min: Math.min(Number(e.target.value), precoMax) }))}
                className="w-full accent-violet-500" />
              <label className="block text-[11px] mt-3 mb-1" style={{ color: BEER.lavandaFraca }}>Máximo</label>
              <input type="range" min={min} max={max} step="1" value={precoMax} aria-label="Preço máximo"
                onChange={e => setRascunho(r => ({ ...r, preco_max: Math.max(Number(e.target.value), precoMin) }))}
                className="w-full accent-violet-500" />
            </Secao>
          )}

          {facetas.estabelecimentos.length > 1 && (
            <Secao titulo="Estabelecimento">
              {facetas.estabelecimentos.map(e => (
                <Opcao key={e.id} rotulo={e.nome} total={e.total} marcado={(rascunho.est || []).includes(String(e.id))} onChange={() => alterna('est', String(e.id))} />
              ))}
            </Secao>
          )}

          {facetas.volumes.length > 0 && (
            <Secao titulo="Volume / tamanho">
              {facetas.volumes.map(v => (
                <Opcao key={v.chave} rotulo={v.label} total={v.total} marcado={(rascunho.vol || []).includes(v.chave)} onChange={() => alterna('vol', v.chave)} />
              ))}
            </Secao>
          )}

          {facetas.origens.length > 0 && (
            <Secao titulo="Origem">
              {facetas.origens.map(o => (
                <Opcao key={o.valor} rotulo={o.valor} total={o.total} marcado={(rascunho.origem || []).includes(o.valor)} onChange={() => alterna('origem', o.valor)} />
              ))}
            </Secao>
          )}

          {!temPreco && facetas.estabelecimentos.length <= 1 && !facetas.volumes.length && !facetas.origens.length && (
            <p className="text-sm" style={{ color: BEER.lavanda }}>Ainda não há produtos suficientes nesta categoria pra filtrar.</p>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${BEER.borda}` }}>
          <button type="button" onClick={() => onAplicar({})} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}>Limpar</button>
          <button type="button" onClick={aplicar} className="flex-1 py-3 rounded-xl text-sm font-black" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>Aplicar filtros</button>
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{ color: BEER.lavandaFraca }}>{titulo}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Opcao({ rotulo, total, marcado, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer text-sm text-white">
      <input type="checkbox" checked={marcado} onChange={onChange} className="w-4 h-4 accent-violet-500" />
      <span className="flex-1">{rotulo}</span>
      <span className="text-[11px]" style={{ color: BEER.lavandaFraca }}>{total}</span>
    </label>
  );
}

import { useRef, useState } from 'react';
import { X, Star, Trash2 } from 'lucide-react';
import { ROXO, DOURADO } from '../../pages/public/Marketplace/theme';

// Grade das fotos do produto no painel (formulário comum e Disk Bebidas):
// a primeira é a PRINCIPAL; arrastar reordena (desktop), ⭐ Principal
// funciona no celular e no computador, lixeira exclui (enviada) e X tira a
// prévia ainda não enviada. O estado vem do useGaleriaFotos.
export default function GradeFotos({ g: gal, onAmpliar, colunas = 'grid-cols-3' }) {
  const { galeria, enviandoFotos, moverFoto, removerFoto, cancelarPendente } = gal;
  const arrastandoRef = useRef(null); // índice da foto sendo arrastada (desktop)
  const [alvoArraste, setAlvoArraste] = useState(null);
  if (!galeria.length) return null;

  return (
    <>
      <p className="text-[11px] text-slate-400 mt-4 mb-2">
        {galeria.length > 1 && 'A primeira é a principal (aparece na vitrine). Arraste pra mudar a ordem ou toque em ⭐ pra tornar principal. '}
        {onAmpliar && 'Toque na foto pra ver em tela cheia.'}
      </p>
      <div className={`grid ${colunas} gap-3`}>
        {galeria.map((g, i) => {
          const src = g.pendente ? g.preview : g.url;
          const podeArrastar = galeria.length > 1 && !enviandoFotos;
          return (
            <div
              key={src}
              draggable={podeArrastar}
              onDragStart={e => { arrastandoRef.current = i; e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={e => { if (arrastandoRef.current == null) return; e.preventDefault(); setAlvoArraste(i); }}
              onDragLeave={() => setAlvoArraste(a => (a === i ? null : a))}
              onDrop={e => { e.preventDefault(); const de = arrastandoRef.current; arrastandoRef.current = null; setAlvoArraste(null); moverFoto(de, i); }}
              onDragEnd={() => { arrastandoRef.current = null; setAlvoArraste(null); }}
              className={`relative rounded-xl overflow-hidden aspect-square border ${i === 0 ? 'ring-2' : g.pendente ? 'border-dashed border-slate-300' : 'border-slate-100'} ${podeArrastar ? 'cursor-grab active:cursor-grabbing' : ''} ${alvoArraste === i ? 'outline outline-2 outline-dashed outline-offset-2 outline-amber-400' : ''} ${enviandoFotos && g.pendente ? 'opacity-60' : ''}`}
              style={i === 0 ? { '--tw-ring-color': ROXO } : {}}
            >
              {/* img (não <button>): no Firefox arrastar a partir de um botão não inicia o drag */}
              <img
                src={src} alt={`Foto ${i + 1}${onAmpliar ? ' — toque pra ver em tela cheia' : ''}`} draggable={false}
                role={onAmpliar ? 'button' : undefined} tabIndex={onAmpliar ? 0 : undefined}
                onClick={() => onAmpliar?.(src)}
                onKeyDown={e => { if (onAmpliar && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAmpliar(src); } }}
                className={`w-full h-full object-cover ${podeArrastar || !onAmpliar ? '' : 'cursor-zoom-in'}`}
              />
              {i === 0
                ? <span className="absolute top-1 left-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white pointer-events-none" style={{ backgroundColor: ROXO }}>Principal</span>
                : <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">{i + 1}</span>}
              {g.pendente ? (
                <button type="button" onClick={() => cancelarPendente(g)} disabled={enviandoFotos} aria-label="Tirar esta foto" title="Tirar esta foto" className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-red-600" />
                </button>
              ) : (
                <button type="button" onClick={() => removerFoto(g)} aria-label="Excluir foto" title="Excluir foto" className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              )}
              {i > 0 && (
                <button type="button" onClick={() => moverFoto(i, 0)} disabled={enviandoFotos} title="Definir como principal"
                  className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1 rounded-lg bg-white/90 shadow" style={{ color: ROXO }}>
                  <Star className="w-3 h-3" fill={DOURADO} color={DOURADO} /> Principal
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

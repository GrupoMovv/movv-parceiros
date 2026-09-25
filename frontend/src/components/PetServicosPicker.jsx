import { useEffect, useState } from 'react';
import api from '../services/api';

// Catálogo do segmento 🐾 Pet vem do backend (config/pet.js) — a tela não
// repete a lista. Cache no módulo: várias telas abertas = uma chamada só.
let cacheCatalogo = null;
export function usePetCatalogo() {
  const [catalogo, setCatalogo] = useState(cacheCatalogo);
  useEffect(() => {
    if (cacheCatalogo) return;
    api.get('/public/pet/catalogo').then(r => { cacheCatalogo = r.data; setCatalogo(r.data); }).catch(() => {});
  }, []);
  return catalogo;
}

function alternar(lista, codigo) {
  return lista.includes(codigo) ? lista.filter(c => c !== codigo) : [...lista, codigo];
}

// Marca os serviços/produtos pet que o parceiro oferece (vários) e os portes
// que atende. Porte só aparece como obrigatório quando tem serviço de
// atendimento (quem só vende ração não precisa).
export default function PetServicosPicker({ servicos, portes, onChange }) {
  const catalogo = usePetCatalogo();
  if (!catalogo) return <p className="text-xs text-slate-400">Carregando opções…</p>;

  const atendePet = servicos.some(c => catalogo.servicos.find(s => s.codigo === c)?.natureza === 'servico');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">O que você oferece? <span className="text-red-500">*</span> <span className="font-normal">(marque todos)</span></p>
        <div className="space-y-2">
          {catalogo.servicos.map(s => {
            const marcado = servicos.includes(s.codigo);
            return (
              <button
                key={s.codigo} type="button"
                onClick={() => onChange({ servicos: alternar(servicos, s.codigo), portes })}
                aria-pressed={marcado}
                className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${marcado ? 'border-[#4C1D95] bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-[11px] font-black flex-shrink-0 ${marcado ? 'bg-[#4C1D95] border-[#4C1D95] text-white' : 'border-slate-300'}`}>{marcado ? '✓' : ''}</span>
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span className="font-semibold text-sm text-slate-800">{s.nome}</span>
                </span>
                <span className="block text-[11px] text-slate-500 mt-1 ml-7">{s.exemplos.join(' · ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {atendePet && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Portes de pet que você atende <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            {catalogo.portes.map(p => {
              const marcado = portes.includes(p.codigo);
              return (
                <button
                  key={p.codigo} type="button" aria-pressed={marcado}
                  onClick={() => onChange({ servicos, portes: alternar(portes, p.codigo) })}
                  className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${marcado ? 'border-[#4C1D95] bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="block font-semibold text-sm text-slate-800">{marcado ? '✓ ' : ''}{p.nome}</span>
                  <span className="block text-[11px] text-slate-500">{p.faixa}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Validação igual à do backend (validarPet) pra avisar antes de enviar.
export function erroPet(catalogo, { servicos, portes }) {
  if (!servicos.length) return 'Marque pelo menos um serviço ou produto pet que você oferece';
  const atende = servicos.some(c => catalogo?.servicos.find(s => s.codigo === c)?.natureza === 'servico');
  if (atende && !portes.length) return 'Marque os portes de pet que você atende';
  return null;
}

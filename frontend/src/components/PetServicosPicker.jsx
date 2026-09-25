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

// Raças em que o parceiro é ESPECIALIZADO (opcional). Nenhuma marcada =
// "atende todas as raças" — é o que o marketplace mostra.
export function PetRacasPicker({ racas, onChange }) {
  const catalogo = usePetCatalogo();
  if (!catalogo) return null;
  const grupos = [['cao', '🐶 Cães'], ['gato', '🐱 Gatos']];
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1">Raças em que você é especialista <span className="font-normal">(opcional)</span></p>
      <p className="text-[11px] text-slate-400 mb-2">
        {racas.length ? `${racas.length} marcada(s).` : 'Nenhuma marcada = aparece como "atende todas as raças".'}
      </p>
      {grupos.map(([especie, titulo]) => (
        <div key={especie} className="mb-2">
          <p className="text-[11px] font-semibold text-slate-400 mb-1">{titulo}</p>
          <div className="flex flex-wrap gap-1.5">
            {catalogo.racas.filter(r => r.especie === especie).map(r => {
              const marcado = racas.includes(r.codigo);
              return (
                <button key={r.codigo} type="button" aria-pressed={marcado}
                  onClick={() => onChange(alternar(racas, r.codigo))}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${marcado ? 'bg-[#4C1D95] border-[#4C1D95] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {r.nome}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tabela de preços: uma linha por serviço de ATENDIMENTO que o parceiro
// marcou, uma coluna por porte que ele atende. Em branco = sem preço (o
// pet shop continua aparecendo, só não entra no filtro de faixa de preço).
export function PetPrecosEditor({ servicos, portes, precos, onChange }) {
  const catalogo = usePetCatalogo();
  if (!catalogo) return null;
  const linhas = catalogo.servicos.filter(s => s.natureza === 'servico' && servicos.includes(s.codigo));
  const colunas = catalogo.portes.filter(p => portes.includes(p.codigo));
  if (!linhas.length || !colunas.length) return null;
  const valor = (s, p) => precos.find(x => x.servico === s && x.porte === p)?.preco ?? '';
  const definir = (s, p, v) => {
    const limpo = v.replace(/[^\d,.]/g, '');
    const resto = precos.filter(x => !(x.servico === s && x.porte === p));
    onChange(limpo === '' ? resto : [...resto, { servico: s, porte: p, preco: limpo }]);
  };
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1">Tabela de preços (R$)</p>
      <p className="text-[11px] text-slate-400 mb-2">Aparece na sua página e no filtro de preço. Deixe em branco o que você não quer divulgar.</p>
      {/* Um bloco por serviço, portes em 2 colunas: cabe no celular sem rolar de lado. */}
      <div className="space-y-2">
        {linhas.map(s => (
          <div key={s.codigo} className="rounded-xl border border-slate-200 p-2.5">
            <p className="text-xs font-semibold text-slate-700 mb-2">{s.emoji} {s.nome}</p>
            <div className="grid grid-cols-2 gap-2">
              {colunas.map(p => (
                <label key={p.codigo} className="block">
                  <span className="block text-[11px] text-slate-500 mb-0.5">{p.nome}</span>
                  <span className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-[#4C1D95]">
                    <span className="pl-2 text-xs text-slate-400">R$</span>
                    <input
                      inputMode="decimal" aria-label={`Preço ${s.nome} porte ${p.nome}`}
                      className="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-sm outline-none"
                      value={String(valor(s.codigo, p.codigo)).replace('.', ',')}
                      onChange={e => definir(s.codigo, p.codigo, e.target.value)}
                      placeholder="—"
                    />
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

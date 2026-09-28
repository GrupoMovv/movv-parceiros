import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PawPrint, EyeOff, Eye, ExternalLink } from 'lucide-react';
import api from '../../../services/api';

// Moderação das avaliações de pet shop (Pet parte 4) — só admin. Ocultar
// esconde o COMENTÁRIO ofensivo da página pública; a nota continua contando
// na média (decisão do Junior, 28/09/2026).
const ABAS = [
  { id: 'comentadas', label: 'Com comentário' },
  { id: 'ocultas', label: 'Ocultadas' },
  { id: 'todas', label: 'Todas' },
];

export default function SindicatoPetAvaliacoes() {
  const [aba, setAba] = useState('comentadas');
  const [lista, setLista] = useState(null);

  const carregar = useCallback(() => {
    setLista(null);
    api.get('/sindicato-pet/avaliacoes', { params: { filtro: aba } })
      .then(r => setLista(r.data.avaliacoes))
      .catch(() => { toast.error('Erro ao carregar avaliações'); setLista([]); });
  }, [aba]);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(av) {
    try {
      await api.post(`/sindicato-pet/avaliacoes/${av.id}/ocultar`, { oculta: !av.oculta });
      toast.success(av.oculta ? 'Comentário visível de novo' : 'Comentário ocultado');
      carregar();
    } catch { toast.error('Erro ao moderar'); }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><PawPrint className="w-6 h-6 text-purple-600" /> Avaliações de Pet Shops</h1>
        <p className="text-slate-500 text-sm mt-1">Só quem foi atendido avalia. Ocultar esconde o comentário da página pública — a nota continua na média.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${aba === a.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {a.label}
          </button>
        ))}
      </div>
      {lista === null ? (
        <p className="text-slate-400 text-sm">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-slate-400 text-sm">Nenhuma avaliação aqui.</p>
      ) : (
        <div className="space-y-3">
          {lista.map(av => (
            <div key={av.id} className={`bg-white rounded-xl border p-4 ${av.oculta ? 'border-slate-200 opacity-75' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">{'⭐'.repeat(av.nota)} <span className="font-semibold text-slate-800">{av.pet_shop}</span>
                    <a href={`/servicos/${av.slug}`} target="_blank" rel="noreferrer" className="inline-flex ml-1 text-slate-400 hover:text-slate-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                  </p>
                  <p className="text-xs text-slate-500">{av.cliente} · {av.pet_nome} · {new Date(av.created_at).toLocaleDateString('pt-BR')}</p>
                  {av.comentario && <p className="text-sm text-slate-700 mt-2">“{av.comentario}”</p>}
                  {av.resposta && <p className="text-xs text-slate-500 mt-1">Resposta do pet shop: {av.resposta}</p>}
                  {av.oculta && <p className="text-[11px] text-red-600 mt-1">Ocultado{av.oculta_por ? ` por ${av.oculta_por}` : ''}</p>}
                </div>
                {av.comentario && (
                  <button type="button" onClick={() => alternar(av)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${av.oculta ? 'border-slate-200 text-slate-600' : 'border-red-200 text-red-600'}`}>
                    {av.oculta ? <><Eye className="w-3.5 h-3.5" /> Mostrar</> : <><EyeOff className="w-3.5 h-3.5" /> Ocultar comentário</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

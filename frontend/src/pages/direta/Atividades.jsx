import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ModalNovaAtividade from '../../components/direta/ModalNovaAtividade';
import { ClipboardList, Plus, Loader2, Trash2 } from 'lucide-react';

const currentMonth = new Date().toISOString().slice(0, 7);

const STATUS_LEAD = [
  { v: 'frio',    l: 'Frio' },
  { v: 'morno',   l: 'Morno' },
  { v: 'quente',  l: 'Quente' },
  { v: 'fechado', l: 'Fechado' },
  { v: 'perdido', l: 'Perdido' },
];

const STATUS_COLOR = {
  frio: 'bg-blue-50 text-blue-600 border-blue-200',
  morno: 'bg-amber-50 text-amber-600 border-amber-200',
  quente: 'bg-orange-50 text-orange-600 border-orange-200',
  fechado: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  perdido: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Atividades() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ reference_month: currentMonth, tipo: '', status_lead: '' });
  const [modalNova, setModalNova] = useState(false);
  const [modalDelete, setModalDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.reference_month) params.reference_month = filters.reference_month;
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.status_lead) params.status_lead = filters.status_lead;
      const res = await api.get('/direta/activities', { params });
      setActivities(res.data);
    } catch { toast.error('Erro ao carregar atividades'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(activity, status_lead) {
    try {
      await api.put(`/direta/activities/${activity.id}`, { status_lead });
      setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status_lead } : a));
    } catch { toast.error('Erro ao atualizar status'); }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    try {
      await api.delete(`/direta/activities/${modalDelete.id}`);
      toast.success('Atividade excluída.');
      setModalDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#0C2D48]" />
            Atividades (CRM)
          </h1>
          <p className="text-slate-500 text-sm mt-1">{activities.length} atividades no filtro atual</p>
        </div>
        <button onClick={() => setModalNova(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Atividade
        </button>
      </div>

      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Mês</label>
            <input type="month" className="input" value={filters.reference_month}
              onChange={e => setFilters(f => ({ ...f, reference_month: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
              <option value="">Todos</option>
              <option value="visita">Visita</option>
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="reuniao">Reunião</option>
            </select>
          </div>
          <div>
            <label className="label">Status do lead</label>
            <select className="input" value={filters.status_lead} onChange={e => setFilters(f => ({ ...f, status_lead: e.target.value }))}>
              <option value="">Todos</option>
              {STATUS_LEAD.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-12 text-slate-400 text-sm">Nenhuma atividade encontrada</div>
      ) : (
        <div className="space-y-3">
          {activities.map(a => (
            <div key={a.id} className="card !p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 capitalize">{a.tipo}</span>
                  {a.contato_nome && <span className="text-slate-400 text-sm">— {a.contato_nome}</span>}
                  {a.contabilidade_name && <span className="text-xs text-slate-400">({a.contabilidade_name})</span>}
                  <span className="text-xs text-slate-400 ml-auto sm:ml-0">{a.data_atividade?.slice(0, 10)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.observacoes}</p>
                {a.proximo_passo && (
                  <p className="text-xs text-[#0C2D48] mt-1">
                    Próximo passo: {a.proximo_passo} {a.data_proximo_passo && `(${a.data_proximo_passo.slice(0, 10)})`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${STATUS_COLOR[a.status_lead]}`}
                  value={a.status_lead}
                  onChange={e => updateStatus(a, e.target.value)}
                >
                  {STATUS_LEAD.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
                <button onClick={() => setModalDelete(a)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalNovaAtividade open={modalNova} onClose={() => setModalNova(false)} onSaved={() => { setModalNova(false); load(); }} />

      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <h2 className="font-bold text-slate-900 text-lg">Excluir Atividade</h2>
              <p className="text-slate-600 text-sm mt-2">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalDelete(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Trash2 className="w-4 h-4" /> Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

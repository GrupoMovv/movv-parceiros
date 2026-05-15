import { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sparkles, Filter, X, MessageSquare, Phone } from 'lucide-react';

const SERVICE_LABEL = { office: 'Movv Office', collections: 'Movv Cobranças' };
const SERVICE_COLOR = {
  office:      'bg-purple-100 text-purple-700 border border-purple-200',
  collections: 'bg-amber-100  text-amber-700  border border-amber-200',
};

const STATUS_CONFIG = {
  novo:        { label: 'Novo',        cls: 'bg-blue-100   text-blue-700   border border-blue-200',   dot: 'bg-blue-500'   },
  contactado:  { label: 'Contactado',  cls: 'bg-cyan-100   text-cyan-700   border border-cyan-200',   dot: 'bg-cyan-500'   },
  em_conversa: { label: 'Em conversa', cls: 'bg-amber-100  text-amber-700  border border-amber-200',  dot: 'bg-amber-500'  },
  convertido:  { label: 'Convertido',  cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  descartado:  { label: 'Descartado', cls: 'bg-slate-100  text-slate-500  border border-slate-200',  dot: 'bg-slate-400'  },
};

export default function AdminInterest() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [selected, setSelected]           = useState(null);
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (serviceFilter) params.service = serviceFilter;
      if (statusFilter)  params.status  = statusFilter;
      const res = await api.get('/interest/admin', { params });
      setItems(res.data);
    } catch {
      toast.error('Erro ao carregar manifestações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [serviceFilter, statusFilter]);

  function openModal(item) {
    setSelected(item);
    setNotes(item.notes || '');
  }

  function closeModal() {
    setSelected(null);
    setNotes('');
  }

  async function updateStatus(newStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.patch(`/interest/admin/${selected.id}`, {
        status: newStatus,
        notes: notes || undefined,
      });
      toast.success('Status atualizado!');
      setSelected(res.data);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.patch(`/interest/admin/${selected.id}`, {
        status: selected.status,
        notes,
      });
      toast.success('Notas salvas!');
      setSelected(res.data);
      load();
    } catch {
      toast.error('Erro ao salvar notas');
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const s = { novo: 0, contactado: 0, em_conversa: 0, convertido: 0, descartado: 0 };
    for (const i of items) s[i.status] = (s[i.status] || 0) + 1;
    return s;
  }, [items]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manifestações de Interesse</h1>
        <p className="text-slate-500 text-sm mt-1">Parceiros interessados nos novos serviços Movv</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`rounded-2xl p-4 border text-left transition-all hover:shadow-md ${
              statusFilter === key ? 'ring-2 ring-movv-900' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide truncate">{cfg.label}</p>
            </div>
            <p className="text-slate-900 font-bold text-2xl">{summary[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="input pl-9 appearance-none w-52"
            >
              <option value="">Todos os serviços</option>
              <option value="office">Movv Office</option>
              <option value="collections">Movv Cobranças</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input pl-9 appearance-none w-52"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Data', 'Parceiro', 'Serviço', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-movv-900 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">Nenhuma manifestação encontrada</td>
                </tr>
              ) : items.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(item.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-900 font-medium">{item.partner_name}</p>
                    <p className="text-[#C9A84C] font-mono text-xs">{item.partner_code}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERVICE_COLOR[item.service]}`}>
                      {SERVICE_LABEL[item.service]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[item.status]?.cls}`}>
                      {STATUS_CONFIG[item.status]?.label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => openModal(item)}
                      className="text-xs text-movv-900 hover:text-movv-700 border border-movv-200 bg-movv-50
                                 hover:border-movv-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-lg">Detalhes do Interesse</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Partner info */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="font-bold text-slate-900">{selected.partner_name}</p>
                <p className="font-mono text-[#C9A84C] text-sm">{selected.partner_code}</p>
                {selected.partner_whatsapp && (
                  <a
                    href={`https://wa.me/55${selected.partner_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Phone className="w-4 h-4" />
                    {selected.partner_whatsapp}
                  </a>
                )}
                {selected.partner_email && (
                  <p className="text-sm text-slate-600">{selected.partner_email}</p>
                )}
              </div>

              {/* Service & Status */}
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERVICE_COLOR[selected.service]}`}>
                  {SERVICE_LABEL[selected.service]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selected.status]?.cls}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
              </div>

              {/* Dates */}
              <div className="text-xs text-slate-500 space-y-1">
                <p>Registrado em: {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                {selected.contacted_at && (
                  <p>Contactado em: {format(new Date(selected.contacted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <MessageSquare className="inline w-3.5 h-3.5 mr-1" />
                  Notas internas
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Adicione observações sobre este lead..."
                  className="input resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="mt-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200
                             bg-slate-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Salvar notas
                </button>
              </div>

              {/* Status actions */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Mudar status:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'contactado',  label: 'Marcar como Contactado', cls: 'border-cyan-200    bg-cyan-50    text-cyan-700    hover:bg-cyan-100'    },
                    { key: 'em_conversa', label: 'Em Conversa',            cls: 'border-amber-200   bg-amber-50   text-amber-700   hover:bg-amber-100'   },
                    { key: 'convertido',  label: 'Convertido',             cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                    { key: 'descartado',  label: 'Descartar',              cls: 'border-slate-200   bg-slate-50   text-slate-600   hover:bg-slate-100'   },
                  ].map(({ key, label, cls }) => (
                    <button
                      key={key}
                      onClick={() => updateStatus(key)}
                      disabled={saving || selected.status === key}
                      className={`text-xs border px-3 py-1.5 rounded-lg transition-colors font-medium
                                  disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

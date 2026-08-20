import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Loader2 } from 'lucide-react';

const TIPOS = [
  { v: 'visita',   l: 'Visita' },
  { v: 'ligacao',  l: 'Ligação' },
  { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'reuniao',  l: 'Reunião' },
];

const STATUS_LEAD = [
  { v: 'frio',    l: 'Frio' },
  { v: 'morno',   l: 'Morno' },
  { v: 'quente',  l: 'Quente' },
  { v: 'fechado', l: 'Fechado' },
  { v: 'perdido', l: 'Perdido' },
];

const EMPTY = {
  data_atividade: new Date().toISOString().slice(0, 10),
  tipo: 'visita',
  contabilidade_id: '',
  contato_nome: '',
  observacoes: '',
  proximo_passo: '',
  data_proximo_passo: '',
  status_lead: 'morno',
};

export default function ModalNovaAtividade({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [contabilidades, setContabilidades] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    api.get('/contabilidades-precos')
      .then(res => setContabilidades(res.data))
      .catch(() => toast.error('Erro ao carregar contabilidades'));
  }, [open]);

  const podeSubmeter = form.observacoes.trim().length > 0;

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/direta/activities', {
        data_atividade:     form.data_atividade,
        tipo:                form.tipo,
        contabilidade_id:   form.contabilidade_id || null,
        contato_nome:        form.contato_nome || null,
        observacoes:         form.observacoes,
        proximo_passo:       form.proximo_passo || null,
        data_proximo_passo:  form.data_proximo_passo || null,
        status_lead:         form.status_lead,
      });
      toast.success('Atividade registrada!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar atividade');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Atividade" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={form.data_atividade} onChange={e => set('data_atividade', e.target.value)} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Contabilidade (opcional)</label>
          <select className="input" value={form.contabilidade_id} onChange={e => set('contabilidade_id', e.target.value)}>
            <option value="">Nenhuma / cliente próprio</option>
            {contabilidades.map(c => (
              <option key={c.partner_id} value={c.partner_id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Nome do contato (opcional)</label>
          <input className="input" value={form.contato_nome} onChange={e => set('contato_nome', e.target.value)} />
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea className="input min-h-[70px] resize-none" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="O que foi tratado nesta interação?" />
        </div>

        <div>
          <label className="label">Status do lead</label>
          <select className="input" value={form.status_lead} onChange={e => set('status_lead', e.target.value)}>
            {STATUS_LEAD.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Próximo passo (opcional)</label>
            <input className="input" value={form.proximo_passo} onChange={e => set('proximo_passo', e.target.value)} />
          </div>
          <div>
            <label className="label">Data do próximo passo</label>
            <input type="date" className="input" value={form.data_proximo_passo} onChange={e => set('data_proximo_passo', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={!podeSubmeter || saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar Atividade
          </button>
        </div>
      </div>
    </Modal>
  );
}

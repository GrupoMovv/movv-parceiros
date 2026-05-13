import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, UserPlus, UserCheck, TrendingUp, Edit2, RefreshCw, Power, Copy, Check, X, Loader2 } from 'lucide-react';
import Modal from '../components/ui/Modal';

export default function MyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [credModal, setCredModal] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', pix_key: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch { toast.error('Erro ao carregar funcionários'); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setForm({ name: '', email: '', whatsapp: '', pix_key: '' });
    setAddModal(true);
  }

  function openEdit(emp) {
    setEditTarget(emp);
    setForm({ name: emp.name, email: emp.email, whatsapp: emp.whatsapp || '', pix_key: emp.pix_key || '' });
    setEditModal(true);
  }

  async function handleAdd() {
    if (!form.name || !form.email) { toast.error('Nome e email são obrigatórios'); return; }
    setSaving(true);
    try {
      const res = await api.post('/employees', form);
      toast.success('Funcionário criado com sucesso!');
      setAddModal(false);
      setCredentials(res.data);
      setCopied(false);
      setCredModal(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar funcionário');
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!form.name || !form.email) { toast.error('Nome e email são obrigatórios'); return; }
    setSaving(true);
    try {
      await api.patch(`/employees/${editTarget.id}`, form);
      toast.success('Dados atualizados!');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally { setSaving(false); }
  }

  async function handleToggle(emp) {
    try {
      await api.patch(`/employees/${emp.id}/toggle`);
      toast.success(emp.is_active ? 'Funcionário desativado' : 'Funcionário reativado');
      load();
    } catch { toast.error('Erro ao alterar status'); }
  }

  async function handleResend(emp) {
    try {
      const res = await api.post(`/employees/${emp.id}/resend`);
      setCredentials(res.data);
      setCopied(false);
      setCredModal(true);
    } catch { toast.error('Erro ao gerar credenciais'); }
  }

  function buildCredText(cred) {
    return [
      '🟣 *Movv Parceiros — Credenciais de Acesso*',
      '',
      `👤 *Nome:* ${cred.name}`,
      `🔑 *Código:* ${cred.code}`,
      `📧 *Email:* ${cred.email}`,
      `🔒 *Senha:* ${cred.plain_password}`,
      '',
      '🌐 Acesse o portal pelo link recebido pela equipe Movv.',
    ].join('\n');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildCredText(credentials));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { toast.error('Erro ao copiar'); }
  }

  const totalActive  = employees.filter(e => e.is_active).length;
  const withRefMonth = employees.filter(e => parseInt(e.month_referrals) > 0).length;
  const totalRefs    = employees.reduce((a, e) => a + parseInt(e.total_referrals || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Funcionários</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie a equipe vinculada à sua contabilidade</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <UserPlus className="w-4 h-4" /> Adicionar Funcionário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users}      label="Total ativos"               value={totalActive}  color="text-[#4A0E8F]"  bg="bg-purple-50"  border="border-purple-200" />
        <StatCard icon={UserCheck}  label="Com indicações no mês"      value={withRefMonth} color="text-[#C9A84C]"  bg="bg-amber-50"   border="border-amber-200" />
        <StatCard icon={TrendingUp} label="Total indicações da equipe" value={totalRefs}    color="text-[#1B5E20]"  bg="bg-emerald-50" border="border-emerald-200" />
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum funcionário cadastrado</p>
            <button onClick={openAdd} className="mt-3 text-sm text-[#4A0E8F] hover:underline">
              Adicionar primeiro funcionário
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Nome', 'Código', 'Email', 'WhatsApp', 'Indic.', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 text-slate-900 font-medium whitespace-nowrap">{emp.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{emp.code}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">{emp.email}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{emp.whatsapp || '—'}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className="text-slate-700 font-medium">{emp.total_referrals}</span>
                      {parseInt(emp.month_referrals) > 0 && (
                        <span className="ml-1 text-[10px] text-[#4A0E8F] bg-purple-50 px-1 rounded">
                          +{emp.month_referrals} mês
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <ActionBtn onClick={() => openEdit(emp)} title="Editar"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          color="text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-300" />
                        <ActionBtn onClick={() => handleResend(emp)} title="Gerar novas credenciais"
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          color="text-amber-600 bg-amber-50 border-amber-200 hover:border-amber-300" />
                        <ActionBtn
                          onClick={() => handleToggle(emp)}
                          title={emp.is_active ? 'Desativar' : 'Reativar'}
                          icon={emp.is_active ? <X className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          color={emp.is_active
                            ? 'text-red-600 bg-red-50 border-red-200 hover:border-red-300'
                            : 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:border-emerald-300'} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar Funcionário">
        <EmployeeForm form={form} setForm={setForm} />
        <div className="flex gap-3 pt-2 mt-4">
          <button onClick={() => setAddModal(false)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Criar Funcionário</>}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar Funcionário">
        {editTarget && (
          <>
            <p className="text-xs text-slate-400 font-mono mb-4">{editTarget.code}</p>
            <EmployeeForm form={form} setForm={setForm} />
            <div className="flex gap-3 pt-2 mt-4">
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleEdit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar alterações'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Credentials Modal */}
      <Modal open={credModal} onClose={() => { setCredModal(false); setCopied(false); }} title="Credenciais de Acesso">
        {credentials && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-sm">
              <CredRow label="Nome"  value={credentials.name} />
              <CredRow label="Código" value={credentials.code} mono />
              <CredRow label="Email"  value={credentials.email} />
              <CredRow label="Senha"  value={credentials.plain_password} mono highlight />
            </div>
            <p className="text-xs text-slate-500">
              Copie e envie via WhatsApp para o funcionário. A senha não será exibida novamente.
            </p>
            <button onClick={handleCopy} className="btn-primary w-full flex items-center justify-center gap-2">
              {copied
                ? <><Check className="w-4 h-4" /> Copiado!</>
                : <><Copy className="w-4 h-4" /> Copiar para WhatsApp</>}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, border }) {
  return (
    <div className={`rounded-2xl p-5 border ${bg} ${border}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ActionBtn({ onClick, title, icon, color }) {
  return (
    <button onClick={onClick} title={title}
      className={`border px-2 py-1 rounded-lg transition-colors ${color}`}>
      {icon}
    </button>
  );
}

function EmployeeForm({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Nome completo *</label>
        <input type="text" className="input" placeholder="Ex: João Silva"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="label">Email *</label>
        <input type="email" className="input" placeholder="funcionario@email.com"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label className="label">WhatsApp</label>
        <input type="text" className="input" placeholder="64999999999"
          value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
      </div>
      <div>
        <label className="label">Chave PIX</label>
        <input type="text" className="input" placeholder="CPF, email ou telefone"
          value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} />
      </div>
    </div>
  );
}

function CredRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 text-xs w-14 flex-shrink-0">{label}</span>
      <span className={`flex-1 text-right break-all ${mono ? 'font-mono' : ''} ${
        highlight ? 'text-[#4A0E8F] font-bold text-base' : 'text-slate-900'
      }`}>
        {value}
      </span>
    </div>
  );
}

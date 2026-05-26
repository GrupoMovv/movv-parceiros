import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Users } from 'lucide-react';

const PIX_TYPES = [
  { value: 'cpf',       label: 'CPF' },
  { value: 'email',     label: 'E-mail' },
  { value: 'telefone',  label: 'Telefone (Celular)' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function pixPlaceholder(type) {
  if (type === 'cpf')       return '000.000.000-00';
  if (type === 'email')     return 'seu@email.com';
  if (type === 'telefone')  return '(62) 99999-0000';
  if (type === 'aleatoria') return 'Cole sua chave aleatória (UUID)';
  return 'Sua chave PIX';
}

function applyPixMask(value, type) {
  if (type === 'cpf')      return maskCPF(value);
  if (type === 'telefone') return maskPhone(value);
  return value;
}

export default function IndicadorPerfil() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', pix_key: '', pix_key_type: 'cpf' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    api.get('/indicators/me')
      .then(res => {
        setProfile(res.data);
        setForm({
          name: res.data.name || '',
          email: res.data.email || '',
          whatsapp: res.data.whatsapp || '',
          pix_key: res.data.pix_key || '',
          pix_key_type: res.data.pix_key_type || 'cpf',
        });
      })
      .catch(() => toast.error('Erro ao carregar perfil'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/indicators/me', form);
      toast.success('Perfil atualizado!');
      refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwdForm.newPassword.length < 6) { toast.error('A nova senha deve ter no mínimo 6 caracteres'); return; }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) { toast.error('As senhas não coincidem'); return; }
    setSavingPwd(true);
    try {
      await api.put('/indicators/me/password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('Senha alterada com sucesso!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-[#4A0E8F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4A0E8F]/10 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-[#4A0E8F]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
          <p className="text-slate-500 text-sm">Gerencie suas informações e chave PIX</p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-slate-800">Informações pessoais</h2>

        <div>
          <label className="label">CPF</label>
          <input
            type="text"
            value={profile?.cpf || ''}
            disabled
            className="input bg-slate-50 text-slate-400 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">O CPF não pode ser alterado</p>
        </div>

        <div>
          <label className="label">Nome completo</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="seu@email.com"
              className="input"
            />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Tipo de chave PIX</label>
          <select
            value={form.pix_key_type}
            onChange={e => setForm(f => ({ ...f, pix_key_type: e.target.value, pix_key: '' }))}
            className="input"
            style={{ backgroundColor: '#fff' }}
          >
            {PIX_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Chave PIX</label>
          <input
            type={form.pix_key_type === 'email' ? 'email' : 'text'}
            value={form.pix_key}
            onChange={e => setForm(f => ({ ...f, pix_key: applyPixMask(e.target.value, f.pix_key_type) }))}
            placeholder={pixPlaceholder(form.pix_key_type)}
            className="input"
          />
          <p className="text-xs text-slate-400 mt-1">
            Aceita: CPF, e-mail, telefone ou chave aleatória
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5"
        >
          {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Salvar Alterações'}
        </button>
      </form>

      {/* Password form */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-slate-800">Alterar senha</h2>

        <div>
          <label className="label">Senha atual</label>
          <input
            type="password"
            value={pwdForm.currentPassword}
            onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))}
            placeholder="Sua senha atual"
            className="input"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nova senha</label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="Mín. 6 caracteres"
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <input
              type="password"
              value={pwdForm.confirmPassword}
              onChange={e => setPwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Repita a senha"
              className="input"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingPwd}
          className="btn-secondary flex items-center justify-center gap-2 px-6 py-2.5"
        >
          {savingPwd ? <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> : 'Alterar Senha'}
        </button>
      </form>
    </div>
  );
}

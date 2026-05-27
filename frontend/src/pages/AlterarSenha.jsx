import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function AlterarSenha() {
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword.length < 6) return toast.error('Nova senha deve ter no mínimo 6 caracteres');
    if (form.newPassword !== form.confirmPassword) return toast.error('As senhas não conferem');
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setDone(true);
      toast.success('Senha alterada com sucesso!');
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-5 h-5 text-[#0C2D48]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Alterar Senha</h1>
            <p className="text-sm text-slate-500">Mantenha sua conta segura</p>
          </div>
        </div>

        {done ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-900 text-lg">Senha alterada com sucesso!</p>
            <p className="text-slate-500 text-sm">
              Você será desconectado em instantes. Faça login novamente com sua nova senha.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Senha atual"
              value={form.currentPassword}
              show={show.current}
              onToggle={() => setShow(p => ({ ...p, current: !p.current }))}
              onChange={v => setForm(p => ({ ...p, currentPassword: v }))}
            />
            <PasswordField
              label="Nova senha"
              value={form.newPassword}
              show={show.new}
              onToggle={() => setShow(p => ({ ...p, new: !p.new }))}
              onChange={v => setForm(p => ({ ...p, newPassword: v }))}
              hint="Mínimo 6 caracteres"
            />
            <PasswordField
              label="Confirmar nova senha"
              value={form.confirmPassword}
              show={show.confirm}
              onToggle={() => setShow(p => ({ ...p, confirm: !p.confirm }))}
              onChange={v => setForm(p => ({ ...p, confirmPassword: v }))}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Nova Senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({ label, value, show, onToggle, onChange, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="input pr-10"
          value={value}
          onChange={e => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

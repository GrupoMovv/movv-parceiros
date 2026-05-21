import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShieldAlert, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function TrocarSenhaObrigatorio() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Se por algum motivo já não precisar trocar, redireciona
  useEffect(() => {
    if (user && !user.must_change_password) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error('A senha deve ter no mínimo 6 caracteres');
    if (newPassword !== confirmPassword) return toast.error('As senhas não conferem');
    setLoading(true);
    try {
      await api.put('/auth/force-change-password', { newPassword });
      await refreshUser();
      toast.success('Senha criada com sucesso! Bem-vindo(a)!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-movv-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Crie sua senha</h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
            Por segurança, você precisa criar uma nova senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova senha</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input pr-10"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNew(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label className="label">Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input pr-10"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Definir Minha Senha
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
          Esta tela é obrigatória e não pode ser ignorada. Ela garante a segurança da sua conta.
        </p>
      </div>
    </div>
  );
}

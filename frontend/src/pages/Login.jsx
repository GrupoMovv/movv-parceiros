import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const partner = await login(identifier.trim(), password);
      toast.success(`Bem-vindo(a), ${partner.name.split(' ')[0]}!`);
      navigate(partner.is_admin ? '/admin' : '/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-movv-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img
                src="/logo-login.png"
                alt="Grupo Movv"
                style={{ height: '120px', width: 'auto' }}
                className="drop-shadow-lg"
              />
            </div>
            <h1 className="text-slate-900 text-2xl font-bold">Movv Parceiros</h1>
            <p className="text-slate-500 text-sm mt-1">Grupo Movv — Itumbiara/GO</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email, Código ou WhatsApp</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="exemplo@email.com ou CONT-IT-001"
                  className="input pl-10"
                  required
                  autoFocus
                />
              </div>
              <p className="text-slate-400 text-xs mt-1">Use seu email, código de parceiro ou número de WhatsApp</p>
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="input pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-movv-900 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              ) : 'Entrar no Portal'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-6">
            Problemas para acessar? Fale com a equipe Movv.
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © {new Date().getFullYear()} Grupo Movv — Itumbiara/GO
        </p>
      </div>
    </div>
  );
}

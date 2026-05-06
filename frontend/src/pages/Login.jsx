import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Gem, Eye, EyeOff, Lock, Hash } from 'lucide-react';

export default function Login() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const partner = await login(code.trim().toUpperCase(), password);
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
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-movv-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-movv-800/80 backdrop-blur-xl border border-movv-700 rounded-3xl p-8 shadow-purple">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gold-gradient items-center justify-center shadow-gold-lg mb-4">
              <Gem className="w-8 h-8 text-movv-900" />
            </div>
            <h1 className="text-gradient text-3xl font-bold">Movv Parceiros</h1>
            <p className="text-movv-400 text-sm mt-1">Grupo Movv — Itumbiara/GO</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Código do Parceiro</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-movv-400" />
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Ex: CONT-IT-001"
                  className="input pl-10 uppercase tracking-widest"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-movv-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-movv-400 hover:text-gold-400 transition-colors"
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
                <span className="w-5 h-5 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
              ) : 'Entrar no Portal'}
            </button>
          </form>

          <p className="text-center text-movv-500 text-xs mt-6">
            Problemas para acessar? Fale com a equipe Movv.
          </p>
        </div>

        <p className="text-center text-movv-600 text-xs mt-6">
          © {new Date().getFullYear()} Grupo Movv — Itumbiara/GO
        </p>
      </div>
    </div>
  );
}

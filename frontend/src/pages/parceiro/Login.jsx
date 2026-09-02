import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiParceiro, { setParceiroToken } from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';

export default function ParceiroLogin() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // 'login' | 'esqueci'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [esqueciEnviado, setEsqueciEnviado] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const res = await apiParceiro.post('/parceiro/auth/login', { email, senha });
      setParceiroToken(res.data.token);
      toast.success(`Bem-vindo, ${res.data.parceiro.nome}!`);
      navigate('/parceiro/painel');
    } catch (err) {
      setErro(err.response?.data?.error || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleEsqueciSenha(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await apiParceiro.post('/parceiro/auth/esqueci-senha', { email });
      setEsqueciEnviado(true);
    } catch {
      toast.error('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <header className="h-16 flex items-center px-6" style={{ backgroundColor: PRETO }}>
        <img src="/iub-logo-sm.png" alt="IUB MAIS" className="h-9 w-auto rounded-lg" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_4px_32px_rgba(15,15,20,0.08)] border border-slate-100 p-8 sm:p-10">
          {modo === 'login' ? (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: PRETO }}>Bem-vindo, Parceiro!</h1>
              <p className="text-slate-500 text-sm mt-2">Acesse o painel do seu comércio</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full border border-slate-200 rounded-xl pl-11 pr-11 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {erro && <p className="text-red-600 text-xs font-medium">{erro}</p>}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold text-base py-3.5 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
                  style={{ backgroundColor: ROXO }}
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setModo('esqueci'); setErro(''); }}
                  className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Esqueci minha senha
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ou</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <Link
                to="/vender"
                className="block w-full text-center text-sm font-semibold py-3.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Ainda não sou parceiro — Cadastrar minha loja
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: PRETO }}>Esqueceu sua senha?</h1>
              <p className="text-slate-500 text-sm mt-2">
                {esqueciEnviado
                  ? 'Se esse email estiver cadastrado, você vai receber um link de redefinição em instantes.'
                  : 'Digite o email cadastrado da sua loja — vamos te mandar um link pra criar uma senha nova.'}
              </p>

              {!esqueciEnviado && (
                <form onSubmit={handleEsqueciSenha} className="mt-8 space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full flex items-center justify-center gap-2 text-white font-semibold text-base py-3.5 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                    style={{ backgroundColor: ROXO }}
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar link de redefinição'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setModo('login'); setEsqueciEnviado(false); }}
                className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 mt-6"
              >
                ← Voltar pro login
              </button>
            </>
          )}
        </div>
      </div>

      <footer className="text-center py-6">
        <p className="text-slate-400 text-xs">IUB MAIS - Marketplace de Itumbiara</p>
      </footer>
    </div>
  );
}

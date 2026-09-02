import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';

export default function ParceiroRedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres');
    if (senha !== confirmar) return setErro('As senhas não conferem');

    setEnviando(true);
    try {
      await apiParceiro.post('/parceiro/auth/redefinir-senha', { token, nova_senha: senha });
      setSucesso(true);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao redefinir senha');
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
          {!token ? (
            <p className="text-center text-slate-500 text-sm">
              Link inválido. <Link to="/parceiro/login" className="font-semibold underline">Voltar pro login</Link>
            </p>
          ) : sucesso ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: ROXO }} />
              <h1 className="text-xl font-extrabold mt-4" style={{ color: PRETO }}>Senha redefinida!</h1>
              <p className="text-slate-500 text-sm mt-2">Já pode entrar com sua nova senha.</p>
              <Link
                to="/parceiro/login"
                className="inline-block mt-6 text-white font-semibold text-sm px-6 py-3 rounded-xl"
                style={{ backgroundColor: ROXO }}
              >
                Ir pro login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: PRETO }}>Criar nova senha</h1>
              <p className="text-slate-500 text-sm mt-2">Mínimo de 8 caracteres.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Nova senha"
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

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Confirmar nova senha"
                    className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                {erro && <p className="text-red-600 text-xs font-medium">{erro}</p>}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold text-base py-3.5 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                  style={{ backgroundColor: ROXO }}
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redefinir senha'}
                </button>
              </form>
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

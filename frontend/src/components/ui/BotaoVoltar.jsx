import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// "← Voltar" padrão do site público. Volta pra tela anterior DENTRO do site;
// quem chegou direto (link do WhatsApp, QR, Google — sem histórico nosso) vai
// pro `fallback`, a home da seção, em vez de sair do site ou não fazer nada.
// `para` força um destino fixo (quando voltar no histórico daria errado,
// ex.: entre níveis do jogo da memória).
//
// history.state.idx é do react-router v6 (BrowserRouter): 0 = primeira tela
// aberta nesta aba.
export default function BotaoVoltar({ fallback = '/marketplace', para, label = 'Voltar', variante = 'escuro', className = '' }) {
  const navigate = useNavigate();

  function voltar() {
    if (para) return navigate(para);
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }

  const cores = variante === 'claro'
    ? 'text-white/90 hover:bg-white/10'
    : 'text-slate-600 hover:bg-slate-100';

  return (
    <button
      type="button"
      onClick={voltar}
      className={`inline-flex items-center gap-1.5 min-h-[40px] px-2 -ml-2 rounded-lg text-sm font-semibold transition-colors ${cores} ${className}`}
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> {label}
    </button>
  );
}

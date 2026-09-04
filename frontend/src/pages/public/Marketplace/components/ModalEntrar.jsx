import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { ROXO, ROXO_ESCURO, PRETO } from '../theme';
import LoginAssociadoForm from './LoginAssociadoForm';

const OPCAO_PARCEIRO = {
  to: '/parceiro/login',
  emoji: '🏢',
  titulo: 'Sou empresa parceira',
  subtitulo: 'Cadastre sua empresa, produtos, serviços e ofertas',
  botao: 'Entrar como parceiro',
};

// Renderizado via portal direto no <body> — de propósito: TopNav é um
// <header sticky> com z-index próprio, o que cria um stacking context
// isolado. Um modal filho dele nunca consegue pintar por cima de outras
// partes da página só com z-index alto (ficava com o topo encoberto pela
// própria navbar). O portal escapa desse contexto de vez.
//
// `onLoginSuccess` é chamado com os dados do associado assim que o login
// (CPF + nascimento) dá certo, pra quem renderiza o modal (TopNav →
// Marketplace) atualizar a sessão sem precisar recarregar a página.
export default function ModalEntrar({ onClose, onLoginSuccess }) {
  const [view, setView] = useState('opcoes'); // opcoes | login-associado

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function aoTeclar(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [onClose]);

  function handleLoginSuccess(dadosAssociado) {
    onLoginSuccess?.(dadosAssociado);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(15,15,20,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'login-associado' && (
          <button
            type="button" onClick={() => setView('opcoes')} aria-label="Voltar"
            className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <button
          type="button" onClick={onClose} aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {view === 'opcoes' ? (
          <>
            <h2 className="text-xl sm:text-2xl font-extrabold text-center" style={{ color: PRETO }}>Como você quer entrar?</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => setView('login-associado')}
                className="flex flex-col items-center text-center gap-2 rounded-2xl border-2 border-slate-100 p-5 hover:border-[#4C1D95] transition-colors duration-200"
              >
                <span className="text-4xl">💎</span>
                <p className="font-bold text-sm" style={{ color: PRETO }}>Sou associado SECI</p>
                <p className="text-slate-500 text-xs leading-relaxed">Acesse sua carteirinha digital e benefícios</p>
                <span className="mt-2 text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-xl text-white w-full" style={{ backgroundColor: ROXO }}>
                  Entrar como associado
                </span>
              </button>

              <Link
                to={OPCAO_PARCEIRO.to}
                onClick={onClose}
                className="flex flex-col items-center text-center gap-2 rounded-2xl border-2 border-slate-100 p-5 hover:border-[#4C1D95] transition-colors duration-200"
              >
                <span className="text-4xl">{OPCAO_PARCEIRO.emoji}</span>
                <p className="font-bold text-sm" style={{ color: PRETO }}>{OPCAO_PARCEIRO.titulo}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{OPCAO_PARCEIRO.subtitulo}</p>
                <span className="mt-2 text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-xl text-white w-full" style={{ backgroundColor: ROXO_ESCURO }}>
                  {OPCAO_PARCEIRO.botao}
                </span>
              </Link>
            </div>
          </>
        ) : (
          <div className="pt-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-center" style={{ color: PRETO }}>💎 Sou associado SECI</h2>
            <p className="text-slate-500 text-xs text-center mt-1.5">Entre com seu CPF e data de nascimento</p>

            <div className="mt-6">
              <LoginAssociadoForm onSuccess={handleLoginSuccess} />
            </div>

            <div className="flex flex-col items-center gap-2 mt-5 text-xs">
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                Não sou associado
              </button>
              <Link to="/cadastrar" onClick={onClose} className="font-semibold underline" style={{ color: ROXO }}>
                Quer virar associado? Faça sua carteirinha grátis
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

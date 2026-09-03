import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ROXO, ROXO_ESCURO, PRETO } from '../theme';

const OPCOES = [
  {
    to: '/cadastrar',
    emoji: '💎',
    titulo: 'Sou associado SECI',
    subtitulo: 'Acesse sua carteirinha digital e benefícios',
    botao: 'Entrar como associado',
  },
  {
    to: '/parceiro/login',
    emoji: '🏢',
    titulo: 'Sou empresa parceira',
    subtitulo: 'Cadastre sua empresa, produtos, serviços e ofertas',
    botao: 'Entrar como parceiro',
  },
];

// Renderizado via portal direto no <body> — de propósito: TopNav é um
// <header sticky> com z-index próprio, o que cria um stacking context
// isolado. Um modal filho dele nunca consegue pintar por cima de outras
// partes da página só com z-index alto (ficava com o topo encoberto pela
// própria navbar). O portal escapa desse contexto de vez.
export default function ModalEntrar({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function aoTeclar(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [onClose]);

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
        <button
          type="button" onClick={onClose} aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl sm:text-2xl font-extrabold text-center" style={{ color: PRETO }}>Como você quer entrar?</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {OPCOES.map(op => (
            <Link
              key={op.to}
              to={op.to}
              onClick={onClose}
              className="flex flex-col items-center text-center gap-2 rounded-2xl border-2 border-slate-100 p-5 hover:border-[#4C1D95] transition-colors duration-200"
            >
              <span className="text-4xl">{op.emoji}</span>
              <p className="font-bold text-sm" style={{ color: PRETO }}>{op.titulo}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{op.subtitulo}</p>
              <span
                className="mt-2 text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-xl text-white w-full"
                style={{ backgroundColor: op.to === '/cadastrar' ? ROXO : ROXO_ESCURO }}
              >
                {op.botao}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

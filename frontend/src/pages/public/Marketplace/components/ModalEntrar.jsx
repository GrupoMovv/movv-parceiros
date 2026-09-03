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
    titulo: 'Sou parceiro',
    subtitulo: 'Gerencie sua loja, produtos e promoções',
    botao: 'Entrar como parceiro',
  },
];

export default function ModalEntrar({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.7)' }} onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
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
                className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl text-white w-full"
                style={{ backgroundColor: op.to === '/cadastrar' ? ROXO : ROXO_ESCURO }}
              >
                {op.botao}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

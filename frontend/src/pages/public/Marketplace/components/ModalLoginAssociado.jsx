import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { PRETO, ROXO } from '../theme';
import LoginAssociadoForm from './LoginAssociadoForm';

// Modal de login standalone (CPF + nascimento) — usado nas páginas de
// produto/promoção, que não têm a navbar do Marketplace (ModalEntrar) pra
// abrir o mesmo fluxo. Mesmo formulário, só troca o chrome ao redor.
export default function ModalLoginAssociado({ onClose, onLoginSuccess }) {
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
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button" onClick={onClose} aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl sm:text-2xl font-extrabold text-center" style={{ color: PRETO }}>💎 Sou associado SECI</h2>
        <p className="text-slate-500 text-xs text-center mt-1.5">Entre com seu CPF e data de nascimento</p>

        <div className="mt-6">
          <LoginAssociadoForm onSuccess={onLoginSuccess} />
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
    </div>,
    document.body
  );
}

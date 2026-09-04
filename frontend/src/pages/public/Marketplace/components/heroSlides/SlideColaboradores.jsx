import { useNavigate } from 'react-router-dom';
import { Buildings, ArrowRight } from '@phosphor-icons/react';
import { DOURADO } from '../../theme';

// Slide 5 — colaborador de empresa parceira (autocadastro por CPF+CNPJ).
// Como as empresas da lista aprovada não têm logo cadastrada, mostra os
// nomes em chips/pills (fallback explicitamente previsto) em vez de tentar
// forçar uma grade de logos que não existem ainda.
export default function SlideColaboradores({ empresas }) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #3B0A78 100%)' }}>
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[50%]">
        <h2 className="text-white font-black text-xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">🎫 Colaborador de empresa parceira?</h2>
        <p className="text-white/75 text-xs sm:text-sm mt-2 hidden sm:block">Ative sua carteirinha SECI + IUB MAIS gratuita agora mesmo.</p>
        <button
          type="button"
          onClick={() => navigate('/cadastrar-associado')}
          className="inline-flex items-center gap-2 w-fit mt-4 sm:mt-6 text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Verificar se posso ativar <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-center px-6 lg:px-10">
        <div className="flex flex-wrap gap-2.5 content-center">
          {empresas.slice(0, 9).map(e => (
            <span key={e.nome} className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3.5 py-2 rounded-full">
              <Buildings size={14} weight="duotone" color={DOURADO} /> {e.nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

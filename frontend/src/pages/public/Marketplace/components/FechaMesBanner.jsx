import { useEffect, useState } from 'react';
import { Fire } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO } from '../theme';

const VERMELHO = '#DC2626';

function useContagemRegressiva(terminaEm) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (!terminaEm) return;
    function atualizar() {
      const restanteMs = new Date(terminaEm).getTime() - Date.now();
      if (restanteMs <= 0) { setTexto('Encerrado'); return; }
      const horas = Math.floor(restanteMs / 3.6e6);
      const min = Math.floor((restanteMs % 3.6e6) / 60000);
      setTexto(`${horas}h ${min}min restantes`);
    }
    atualizar();
    const id = setInterval(atualizar, 30000);
    return () => clearInterval(id);
  }, [terminaEm]);
  return texto;
}

// Dois modos, conforme o que useFechaMesProximo devolveu: banner discreto
// nos 3 dias antes, banner grande + contagem regressiva no dia. Fora dessa
// janela (nem perto nem hoje) não renderiza nada — não é dado "carregando",
// é a maior parte do mês mesmo.
export default function FechaMesBanner({ info }) {
  const contagem = useContagemRegressiva(info?.ativo_hoje ? info.termina_em : null);

  if (!info || !info.habilitado_globalmente) return null;

  if (info.ativo_hoje) {
    return (
      <button
        type="button"
        onClick={() => document.querySelector('#fecha-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="w-full text-left px-4 sm:px-8 lg:px-16 py-3.5 flex items-center justify-center gap-3 flex-wrap text-white"
        style={{ background: `linear-gradient(90deg, ${VERMELHO} 0%, ${DOURADO_ESCURO} 100%)` }}
      >
        <span className="flex items-center gap-2 font-black text-sm sm:text-base uppercase tracking-wide">
          <Fire size={20} weight="fill" /> Fecha Mês do IUB MAIS — HOJE!
        </span>
        <span className="text-xs sm:text-sm font-medium text-white/90">Descontos exclusivos até 23:59</span>
        <span
          className="text-xs sm:text-sm font-black px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
        >
          ⏱ {contagem}
        </span>
      </button>
    );
  }

  if (info.dias_restantes > 0 && info.dias_restantes <= 3) {
    return (
      <div className="w-full text-center px-4 py-2 text-xs sm:text-sm font-semibold" style={{ backgroundColor: `${DOURADO}18`, color: '#92700C' }}>
        <Fire size={14} weight="fill" className="inline -mt-0.5 mr-1" />
        Fecha Mês chegando em {info.dias_restantes} {info.dias_restantes === 1 ? 'dia' : 'dias'}! Marque na agenda.
      </div>
    );
  }

  return null;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Texto de contagem regressiva, só quando falta menos de 24h (senão a
// urgência vira ruído visual em toda oferta de 7/15/30 dias).
function useContagemRegressiva(dataFim) {
  const [texto, setTexto] = useState(null);

  useEffect(() => {
    function calcular() {
      const restanteMs = new Date(dataFim).getTime() - Date.now();
      if (restanteMs <= 0 || restanteMs > 24 * 3600 * 1000) { setTexto(null); return; }
      const horas = Math.floor(restanteMs / 3.6e6);
      const min = Math.floor((restanteMs % 3.6e6) / 60000);
      setTexto(horas > 0 ? `Termina em ${horas}h!` : `Termina em ${min}min!`);
    }
    calcular();
    const interval = setInterval(calcular, 60000);
    return () => clearInterval(interval);
  }, [dataFim]);

  return texto;
}

export default function CardPromocao({ produto: promocao, className = '', style }) {
  const contagem = useContagemRegressiva(promocao.data_fim);
  const vagasRestantes = promocao.limite_usos ? promocao.limite_usos - promocao.usos_atuais : null;

  return (
    <Link
      to={`/marketplace/promocao/${promocao.id}`}
      style={style}
      className={`group flex flex-col bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out ${className}`}
    >
      <div className="relative w-full h-[200px] sm:h-[240px] lg:h-[260px] rounded-lg overflow-hidden bg-white flex items-center justify-center">
        {promocao.foto_url ? (
          <img src={promocao.foto_url} alt={promocao.titulo} loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
            <ImageOff className="w-10 h-10" />
          </div>
        )}

        {promocao.desconto_pct && (
          <span className="absolute top-2 left-2 text-sm font-black px-3 py-1 rounded uppercase tracking-wide" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
            -{promocao.desconto_pct}% OFF
          </span>
        )}
        {promocao.exclusivo_associado && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-sm font-black px-3 py-1 rounded uppercase tracking-wide text-white" style={{ backgroundColor: ROXO }}>
            <Diamond size={12} weight="fill" /> SECI
          </span>
        )}
        {(contagem || vagasRestantes !== null) && (
          <span className="absolute bottom-2 left-2 right-2 text-xs font-bold text-center px-2 py-1 rounded text-white truncate" style={{ backgroundColor: 'rgba(15,15,20,0.75)' }}>
            {contagem || `Faltam ${vagasRestantes} ${vagasRestantes === 1 ? 'vaga' : 'vagas'}!`}
          </span>
        )}
      </div>

      <div className="pt-3 flex-1 flex flex-col">
        <p className="text-sm text-gray-500 truncate">{promocao.parceiro_nome}</p>
        <p className="text-base font-medium leading-snug line-clamp-2 min-h-[2.6em] mt-0.5" style={{ color: PRETO }}>
          {promocao.titulo}
        </p>

        <div className="mt-2">
          <p className="text-gray-400 text-sm line-through">{formatarPreco(promocao.preco_de)}</p>
          <p className="font-bold text-xl leading-tight" style={{ color: ROXO }}>{formatarPreco(promocao.preco_por)}</p>
        </div>
      </div>
    </Link>
  );
}

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
      className={`group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-1 ${className}`}
    >
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-50">
        {promocao.foto_url ? (
          <img
            src={promocao.foto_url} alt={promocao.titulo} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="w-8 h-8" />
          </div>
        )}

        {promocao.desconto_pct && (
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide shadow-sm"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            {promocao.desconto_pct}% OFF
          </span>
        )}
        {promocao.exclusivo_associado && (
          <span
            className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide shadow-sm text-white"
            style={{ backgroundColor: ROXO }}
          >
            <Diamond size={11} weight="duotone" /> SECI
          </span>
        )}

        {(contagem || vagasRestantes !== null) && (
          <span className="absolute bottom-2.5 left-2.5 right-2.5 text-[10px] font-bold text-center px-2 py-1 rounded-full text-white" style={{ backgroundColor: 'rgba(15,15,20,0.75)' }}>
            {contagem || `Faltam ${vagasRestantes} ${vagasRestantes === 1 ? 'vaga' : 'vagas'}!`}
          </span>
        )}
      </div>

      <div className="pt-2.5 flex-1 flex flex-col">
        <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: PRETO }}>
          {promocao.titulo}
        </p>

        <div className="mt-1.5">
          <p className="text-slate-400 text-xs line-through">{formatarPreco(promocao.preco_de)}</p>
          <p className="font-extrabold text-base" style={{ color: ROXO }}>{formatarPreco(promocao.preco_por)}</p>
        </div>

        <p className="text-slate-400 text-xs mt-1 truncate">{promocao.parceiro_nome}</p>
      </div>
    </Link>
  );
}

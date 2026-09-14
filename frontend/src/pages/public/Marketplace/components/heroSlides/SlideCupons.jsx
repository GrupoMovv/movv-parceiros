import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { ImageOff } from 'lucide-react';

// Slide 7 do redesign — fandango (marquee) dos cupons ativos da Roleta.
// Só nome do parceiro + % (nunca código do cupom nem quem ganhou, ver
// getCuponsDisponiveis) — reusa .marquee-track já definido em index.css
// (nunca tinha sido consumido ainda). Só aparece no carrossel (ver
// HeroBannerCarousel) se `total > 0`.
export default function SlideCupons({ total, amostra }) {
  const navigate = useNavigate();
  // Duplica a amostra pra fazer o loop parecer infinito — o keyframe
  // marquee-scroll anda exatamente -50%, que cai bem no início da 2ª cópia.
  const faixa = amostra.length > 0 ? [...amostra, ...amostra] : [];

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(120deg, #B87E00 0%, #FFB800 45%, #7C3AED 135%)' }}
    >
      <p className="text-black font-black text-lg sm:text-2xl lg:text-3xl text-center">🎁 CUPONS DISPONÍVEIS</p>
      <p className="font-black mt-1 text-xl sm:text-3xl lg:text-4xl text-white text-center" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
        {total} {total === 1 ? 'cupom esperando' : 'cupons esperando'} por você
      </p>

      {faixa.length > 0 && (
        <div className="w-full max-w-3xl mt-5 sm:mt-7 overflow-hidden">
          <div className="marquee-track flex gap-3 w-fit">
            {faixa.map((c, i) => (
              <div
                key={i}
                className="flex-shrink-0 bg-white rounded-2xl shadow-lg px-3 py-2.5 flex items-center gap-2 w-[150px] sm:w-[180px]"
              >
                {c.parceiro_logo ? (
                  <img src={c.parceiro_logo} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0" loading="lazy" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <ImageOff className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-700 truncate">{c.parceiro_nome}</p>
                  <p className="text-sm sm:text-base font-black text-emerald-600">{c.desconto_percentual}% OFF</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/jogar/roleta')}
        className="inline-flex items-center gap-2 mt-5 sm:mt-7 text-sm sm:text-base font-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-xl hover:scale-[1.03] transition-transform bg-white text-slate-900"
      >
        🎡 Girar Roleta <ArrowRight size={18} weight="bold" />
      </button>
    </div>
  );
}

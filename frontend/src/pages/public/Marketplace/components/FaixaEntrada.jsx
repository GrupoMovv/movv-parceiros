import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { getPainelToken } from '../../../../services/apiPainel';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from '../theme';

// Porta de entrada da home. Fica FORA do HeroBannerCarousel de propósito:
// o carrossel tem autoplay e 6 slides, então um CTA lá dentro apareceria
// ~1/6 do tempo e sumiria sozinho — justamente o problema que isso resolve
// ("ninguém acha por onde entrar").
//
// Quem já tem sessão de associado não precisa de "quero entrar": vê o
// atalho pro próprio painel. A checagem é só do token no localStorage, sem
// request — se estiver vencido, o /meu resolve o redirecionamento.
export default function FaixaEntrada() {
  const logado = Boolean(getPainelToken());

  return (
    <section className="bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-5 sm:py-7">
        <p
          className="text-center font-black text-lg sm:text-2xl leading-tight"
          style={{ color: PRETO, fontFamily: 'Poppins, sans-serif' }}
        >
          Mais qualidade. Mais confiança. <span style={{ color: ROXO }}>Mais vantagens.</span>
        </p>
        <p className="text-center text-slate-500 text-xs sm:text-sm mt-1.5">
          {logado
            ? 'Você já está conectado — aproveite os descontos de associado.'
            : 'Entre pra ver seus descontos ou cadastre-se em 1 minuto.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:max-w-2xl sm:mx-auto">
          {logado ? (
            <Link
              to="/meu"
              className="flex-1 min-h-[56px] flex items-center justify-center gap-2 rounded-2xl font-black text-base transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: ROXO, color: '#fff', border: `2px solid ${ROXO_ESCURO}` }}
            >
              🎯 MEU PAINEL <ArrowRight size={18} weight="bold" />
            </Link>
          ) : (
            <Link
              to="/entrar"
              className="flex-1 min-h-[56px] flex flex-col items-center justify-center rounded-2xl transition-transform hover:scale-[1.02] leading-tight"
              style={{ backgroundColor: ROXO, color: '#fff', border: `2px solid ${ROXO_ESCURO}` }}
            >
              <span className="font-black text-base">🎯 QUERO ENTRAR</span>
              <span className="text-[11px] font-semibold text-white/75">Já tenho conta</span>
            </Link>
          )}

          <Link
            to="/cadastrar"
            className="flex-1 min-h-[56px] flex flex-col items-center justify-center rounded-2xl transition-transform hover:scale-[1.02] leading-tight"
            style={{ backgroundColor: DOURADO, color: PRETO, border: '2px solid #D99F00' }}
          >
            <span className="font-black text-base">✨ CADASTRAR AGORA</span>
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(15,15,20,0.7)' }}>Grátis para associados</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Storefront, ArrowRight } from '@phosphor-icons/react';
import { MASCOTE_URL } from '../../components/MascoteIubMais';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './Marketplace/theme';

// Bifurcação de entrada. Existe porque quem chegava na home não sabia por
// onde entrar: consumidor e empresa têm logins DIFERENTES (JWTs separados,
// ver apiPainel vs apiParceiro) e a tela antiga não deixava isso claro.
//
// Não faz login nenhum — só direciona:
//   consumidor -> /jogar/login (CPF + nascimento, sessão do associado)
//   empresa    -> /vender      (fluxo de cadastro/contato do parceiro)
const OPCOES = [
  {
    chave: 'consumidor',
    emoji: '👤',
    Icone: User,
    titulo: 'SOU CONSUMIDOR',
    descricao: 'Ganho descontos exclusivos em empresas parceiras',
    rotulo: 'Entrar como Consumidor',
    destino: '/jogar/login',
    // Um tom acima do fundo (#7C3AED, o mesmo do gradiente do SlideHero):
    // em ROXO puro o card sumia contra o fundo roxo e só a borda o
    // separava. A borda lilás fecha a aresta.
    fundo: '#7C3AED',
    fundoBotao: '#FFFFFF',
    corBotao: ROXO,
    borda: '#A78BFA',
  },
  {
    chave: 'empresa',
    emoji: '🏪',
    Icone: Storefront,
    titulo: 'SOU EMPRESA',
    descricao: 'Cadastro meus produtos e vendo na plataforma',
    rotulo: 'Entrar como Empresa',
    destino: '/vender',
    fundo: DOURADO,
    fundoBotao: PRETO,
    corBotao: '#FFFFFF',
    borda: '#D99F00',
  },
];

export default function Entrar() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8 sm:py-12"
      style={{ background: `linear-gradient(160deg, ${ROXO_ESCURO} 0%, ${ROXO} 55%, #2D0A5C 100%)` }}
    >
      <div className="w-full max-w-[460px] flex flex-col flex-1">
        <div className="text-center">
          <img src={MASCOTE_URL} alt="" className="h-20 sm:h-24 mx-auto object-contain" style={{ filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.35))' }} />
          <h1 className="text-white font-black text-2xl sm:text-3xl mt-3 leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Como você quer usar o <span style={{ color: DOURADO }}>IUB MAIS+</span>?
          </h1>
          <p className="text-white/70 text-sm mt-2">Escolha por onde entrar — cada perfil tem seu acesso.</p>
        </div>

        <div className="flex flex-col gap-4 mt-6">
          {OPCOES.map(o => (
            <button
              key={o.chave}
              type="button"
              onClick={() => navigate(o.destino)}
              className="w-full text-left rounded-3xl p-5 transition-transform hover:scale-[1.02] active:scale-[0.99]"
              style={{ backgroundColor: o.fundo, border: `2px solid ${o.borda}`, boxShadow: '0 12px 28px rgba(0,0,0,0.25)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{o.emoji}</span>
                <p
                  className="font-black text-lg sm:text-xl"
                  style={{ color: o.chave === 'empresa' ? PRETO : '#FFFFFF', fontFamily: 'Poppins, sans-serif' }}
                >
                  {o.titulo}
                </p>
              </div>
              <p
                className="text-sm mt-2 leading-snug"
                style={{ color: o.chave === 'empresa' ? 'rgba(15,15,20,0.75)' : 'rgba(255,255,255,0.92)' }}
              >
                {o.descricao}
              </p>
              <span
                className="mt-4 w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl font-bold text-base"
                style={{ backgroundColor: o.fundoBotao, color: o.corBotao }}
              >
                {o.rotulo} <ArrowRight size={18} weight="bold" />
              </span>
            </button>
          ))}
        </div>

        <Link
          to="/marketplace"
          className="mt-6 mb-2 inline-flex items-center justify-center gap-2 text-white/70 text-sm font-semibold hover:text-white transition-colors min-h-[48px]"
        >
          <ArrowLeft size={16} weight="bold" /> Voltar pra home
        </Link>
      </div>
    </div>
  );
}

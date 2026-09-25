import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../Marketplace/theme';
import { CascaAcesso } from './AcessoUi';

// Porta de entrada do IUB MAIS+ pra quem ainda não tem conta. Três caminhos
// que a pessoa reconhece pelo que ELA é (não pelo nome técnico do perfil):
// a tela antiga misturava "Associado SECI" e "Parceiro" e muita gente
// desistia no CPF não encontrado.
const CAMINHOS = [
  {
    chave: 'seci',
    emoji: '🏪',
    titulo: 'SOU ASSOCIADO SECI',
    subtitulo: 'Sindicato do Comércio de Itumbiara',
    descricao: 'Já tenho minha carteirinha',
    rotulo: 'ENTRAR',
    destino: '/acesso/associado',
    fundo: '#7C3AED', borda: '#A78BFA', texto: '#FFFFFF', textoSuave: 'rgba(255,255,255,0.85)',
    fundoBotao: '#FFFFFF', corBotao: ROXO,
  },
  {
    chave: 'comercio',
    emoji: '🆕',
    titulo: 'EMPRESA DO COMÉRCIO?',
    subtitulo: 'Quero me associar ao SECI',
    descricao: 'Cadastro em 2 minutos',
    rotulo: 'CADASTRAR',
    destino: '/acesso/comercio',
    fundo: DOURADO, borda: '#D99F00', texto: PRETO, textoSuave: 'rgba(15,15,20,0.75)',
    fundoBotao: PRETO, corBotao: '#FFFFFF',
  },
  {
    chave: 'basico',
    emoji: '👤',
    titulo: 'OUTROS SEGMENTOS',
    subtitulo: 'Posto, restaurante, hotel, indústria...',
    descricao: 'Cadastro básico em 1 minuto',
    rotulo: 'CADASTRAR',
    destino: '/acesso/basico',
    fundo: '#FFFFFF', borda: '#E9D5FF', texto: PRETO, textoSuave: '#475569',
    fundoBotao: ROXO, corBotao: '#FFFFFF',
  },
];

export default function Acesso() {
  const navigate = useNavigate();

  return (
    <CascaAcesso titulo="Como você acessa o IUB MAIS+?" mascote voltarPara="/marketplace">
      <div className="flex flex-col gap-4">
        {CAMINHOS.map(c => (
          <button
            key={c.chave}
            type="button"
            onClick={() => navigate(c.destino)}
            className="w-full text-left rounded-3xl p-5 transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ backgroundColor: c.fundo, border: `2px solid ${c.borda}`, boxShadow: '0 12px 28px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none">{c.emoji}</span>
              <div>
                <p className="font-black text-lg sm:text-xl leading-tight" style={{ color: c.texto, fontFamily: 'Poppins, sans-serif' }}>
                  {c.titulo}
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: c.texto }}>{c.subtitulo}</p>
                <p className="text-sm mt-1" style={{ color: c.textoSuave }}>{c.descricao}</p>
              </div>
            </div>
            <span
              className="mt-4 w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl font-black text-base"
              style={{ backgroundColor: c.fundoBotao, color: c.corBotao }}
            >
              {c.rotulo} <ArrowRight size={18} weight="bold" />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-white/80 text-sm">Já tem conta?</p>
        <Link
          to="/entrar"
          className="mt-2 w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-base border-2 border-white text-white hover:bg-white/10 transition-colors"
        >
          FAZER LOGIN
        </Link>
        <Link to="/entrar/esqueci-senha" className="inline-block mt-3 text-white/80 text-sm font-semibold underline underline-offset-4 min-h-[44px] leading-[44px]">
          Esqueci minha senha
        </Link>
        <p className="text-white/60 text-xs mt-4">
          É empresa e quer vender no IUB MAIS+?{' '}
          <Link to="/vender" className="underline underline-offset-2 font-semibold text-white/80">Cadastre sua loja</Link>
        </p>
      </div>
    </CascaAcesso>
  );
}

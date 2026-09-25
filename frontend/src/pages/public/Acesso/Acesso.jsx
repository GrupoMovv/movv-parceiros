import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../Marketplace/theme';
import { CascaAcesso } from './AcessoUi';

// Porta única de entrada (o boneco "Logar" do menu leva aqui). Só duas
// escolhas, sem jargão sindical: quem já tem conta entra; quem não tem
// cria — e o sistema descobre sozinho, pelo CNPJ/CPF, se é associado SECI.
export default function Acesso() {
  const navigate = useNavigate();

  return (
    <CascaAcesso titulo="Bem-vindo(a) ao IUB MAIS+!" mascote voltarPara="/marketplace">
      <Opcao
        emoji="🔐" titulo="JÁ TENHO CONTA" rotulo="ENTRAR"
        onClick={() => navigate('/entrar')}
        fundo="#7C3AED" borda="#A78BFA" texto="#FFFFFF" fundoBotao="#FFFFFF" corBotao={ROXO}
      />

      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <span className="flex-1 h-px bg-white/30" />
        <span className="text-white/70 text-sm font-bold">OU</span>
        <span className="flex-1 h-px bg-white/30" />
      </div>

      <Opcao
        emoji="🆕" titulo="PRIMEIRO ACESSO" rotulo="CRIAR CONTA"
        linhas={['Cadastre em 1 minuto', 'Grátis pra todos']}
        onClick={() => navigate('/criar-conta')}
        fundo={DOURADO} borda="#D99F00" texto={PRETO} fundoBotao={PRETO} corBotao="#FFFFFF"
      />

      {/* Empresa que quer vender no IUB MAIS+ (parceiro) é outro cadastro —
          fica separado das contas de pessoa, mas visível pra empresa não se
          sentir esquecida. */}
      <p className="text-center text-white/70 text-sm font-semibold mt-8 mb-3">É empresa e quer vender no IUB MAIS+?</p>
      <Opcao
        emoji="🏪" titulo="TENHO UMA EMPRESA" rotulo="CADASTRAR MINHA EMPRESA"
        linhas={['Cadastre grátis no IUB MAIS+']}
        onClick={() => navigate('/vender')}
        fundo="#FFFFFF" borda="#E9D5FF" texto={PRETO} fundoBotao={ROXO} corBotao="#FFFFFF"
      />
    </CascaAcesso>
  );
}

function Opcao({ emoji, titulo, linhas = [], rotulo, onClick, fundo, borda, texto, fundoBotao, corBotao }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-3xl p-5 transition-transform hover:scale-[1.02] active:scale-[0.99]"
      style={{ backgroundColor: fundo, border: `2px solid ${borda}`, boxShadow: '0 12px 28px rgba(0,0,0,0.25)' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{emoji}</span>
        <div>
          <p className="font-black text-xl leading-tight" style={{ color: texto, fontFamily: 'Poppins, sans-serif' }}>{titulo}</p>
          {linhas.map(l => <p key={l} className="text-sm font-semibold mt-1" style={{ color: texto, opacity: 0.85 }}>{l}</p>)}
        </div>
      </div>
      <span
        className="mt-4 w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl font-black text-base"
        style={{ backgroundColor: fundoBotao, color: corBotao }}
      >
        {rotulo} <ArrowRight size={18} weight="bold" />
      </span>
    </button>
  );
}

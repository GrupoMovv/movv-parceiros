import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import MascoteIubMais from '../../../components/MascoteIubMais';

// Landing dos IUB MAIS+ Joguinhos — hoje só a Roleta existe de verdade;
// Tigrinho do Bem e Raspadinha são cards "em breve" (sem rota própria
// ainda, só preparando o terreno visual).
export default function JogosHub() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  // Otimista (ver mesmo comentário em Roleta.jsx) — quem decide de
  // verdade é o POST /roleta/girar na hora do clique.
  const [podeJogar, setPodeJogar] = useState(true);
  const [jogaramHoje, setJogaramHoje] = useState(0);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/cadastrar', { replace: true }); return; }
    apiPainel.get('/roleta/status')
      .then(res => { setPodeJogar(res.data.pode_jogar); setJogaramHoje(res.data.jogaram_hoje); })
      .catch(err => {
        if (err.response?.status === 401) navigate('/cadastrar', { replace: true });
        else console.error('Erro ao carregar status dos joguinhos:', err);
      })
      .finally(() => setCarregando(false));
  }, [navigate]);

  if (carregando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro">
        <MascoteIubMais tamanho="medium" animacao="pulse" />
        <p className="text-white/80 mt-4">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro pb-16">
      <header className="text-center pt-10 px-4">
        <h1 className="text-3xl sm:text-4xl font-black text-white">🎮 IUB MAIS+ JOGUINHOS</h1>
        <p className="text-iub-dourado font-black uppercase text-sm sm:text-base mt-2 tracking-wide">
          Onde você NUNCA perde!
        </p>
      </header>

      <div className="max-w-4xl mx-auto mt-8 px-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigate('/jogar/roleta')}
          className="text-left bg-white rounded-3xl p-5 shadow-xl hover:scale-[1.02] transition-transform sm:col-span-1"
        >
          <div className="text-5xl text-center">🎡</div>
          <h2 className="font-black text-lg text-iub-roxo text-center mt-2">ROLETA DA SORTE</h2>
          <p className="text-center text-sm font-semibold mt-1 text-iub-roxo-escuro">
            {podeJogar ? '1 giro disponível hoje!' : 'Você já jogou hoje — volta amanhã!'}
          </p>
          <p className="text-center text-xs text-iub-cinza mt-2">🔥 {jogaramHoje} {jogaramHoje === 1 ? 'pessoa jogou' : 'pessoas jogaram'} hoje</p>
          <p className="btn-iub-dourado w-full text-center mt-4 py-2.5 text-sm">JOGAR AGORA</p>
        </button>

        <CardEmBreve emoji="🎰" nome="TIGRINHO DO BEM" />
        <CardEmBreve emoji="✨" nome="RASPADINHA IUB+" />
      </div>
    </div>
  );
}

function CardEmBreve({ emoji, nome }) {
  return (
    <div className="relative bg-white/10 rounded-3xl p-5 overflow-hidden">
      <div className="blur-[3px] opacity-50 pointer-events-none select-none">
        <div className="text-5xl text-center">{emoji}</div>
        <h2 className="font-black text-lg text-white text-center mt-2">{nome}</h2>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-iub-dourado text-black">
          Em breve
        </span>
        <p className="text-white/80 text-xs font-semibold">Aguardem!</p>
      </div>
    </div>
  );
}

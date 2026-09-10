import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import MascoteIubMais from '../../../components/MascoteIubMais';
import RoletaWheel, { calcularRotacaoAlvo } from './components/RoletaWheel';

const DURACAO_GIRO_MS = 5000;

function formatarValidade(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dispararConfete() {
  const duracao = 2000;
  const fim = Date.now() + duracao;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: ['#FFB800', '#7C3AED', '#A855F7'] });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: ['#FFB800', '#7C3AED', '#A855F7'] });
    if (Date.now() < fim) requestAnimationFrame(frame);
  })();
}

export default function Roleta() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [podeJogar, setPodeJogar] = useState(false);
  const [diasSeguidos, setDiasSeguidos] = useState(0);
  const [girando, setGirando] = useState(false);
  const [rotacao, setRotacao] = useState(0);
  const [resultado, setResultado] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/cadastrar', { replace: true }); return; }
    apiPainel.get('/roleta/status')
      .then(res => { setPodeJogar(res.data.pode_jogar); setDiasSeguidos(res.data.dias_seguidos); })
      .catch(() => toast.error('Erro ao carregar a roleta'))
      .finally(() => setCarregando(false));
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [navigate]);

  async function girar() {
    if (girando || !podeJogar) return;
    setGirando(true);
    try {
      const res = await apiPainel.post('/roleta/girar');
      const alvo = calcularRotacaoAlvo(rotacao, res.data.premio_sorteado_percentual);
      setRotacao(alvo);
      timeoutRef.current = setTimeout(() => {
        setGirando(false);
        setPodeJogar(false);
        setDiasSeguidos(res.data.dias_seguidos);
        setResultado(res.data);
        dispararConfete();
      }, DURACAO_GIRO_MS);
    } catch (err) {
      setGirando(false);
      if (err.response?.status === 409) {
        setPodeJogar(false);
        toast.error(err.response.data.error);
      } else if (err.response?.status === 503) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Erro ao girar a roleta, tenta de novo');
      }
    }
  }

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
        <h1 className="text-3xl sm:text-4xl font-black text-white">🎡 ROLETA DA SORTE</h1>
        <p className="text-white/90 font-semibold mt-1">Você sempre ganha um cupom!</p>
        <p className="text-iub-dourado font-black uppercase text-sm sm:text-base mt-2 tracking-wide">
          O joguinho que você nunca perde!
        </p>
      </header>

      <div className="flex justify-center mt-4">
        <MascoteIubMais tamanho="large" animacao={girando ? 'bounce' : 'float'} />
      </div>

      <div className="mt-4">
        <RoletaWheel rotacao={rotacao} girando={girando} />
      </div>

      <div className="text-center mt-8 px-4">
        <button
          type="button"
          onClick={girar}
          disabled={!podeJogar || girando}
          className="btn-iub-dourado text-lg sm:text-xl px-10 py-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {girando ? 'Girando...' : '🎡 GIRAR AGORA'}
        </button>

        <p className="text-white/80 text-sm mt-4">
          {podeJogar ? 'Você tem 1 giro hoje' : 'Você já jogou hoje — volta amanhã pra girar de novo!'}
        </p>
        {diasSeguidos > 1 && (
          <p className="text-iub-dourado font-bold text-sm mt-1">🔥 {diasSeguidos} dias seguidos jogando!</p>
        )}

        <Link to="/meu/cupons" className="inline-block text-white/70 hover:text-white text-sm underline mt-6">
          Ver meus cupons
        </Link>
      </div>

      {resultado && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setResultado(null)}>
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 text-center relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <MascoteIubMais tamanho="medium" animacao="bounce" className="mx-auto" />
            <h2 className="text-2xl font-black text-iub-roxo mt-2">🎊 VOCÊ GANHOU!</h2>
            <p className="text-iub-cinza text-sm mt-1">
              {resultado.capeado
                ? 'Seu parceiro está te dando o desconto máximo dele!'
                : 'Prêmio sorteado na hora, sem pegadinha.'}
            </p>

            <div className="mt-4 rounded-2xl border-2 border-dashed border-iub-roxo/30 p-4">
              <div className="flex items-center justify-center gap-2">
                {resultado.parceiro.logo_url && (
                  <img src={resultado.parceiro.logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                )}
                <p className="font-bold text-iub-roxo-escuro">{resultado.parceiro.nome}</p>
              </div>
              <p className="text-4xl font-black text-iub-dourado-escuro mt-2">
                {resultado.cupom.desconto_percentual === 100 ? 'GRÁTIS' : `${resultado.cupom.desconto_percentual}% OFF`}
              </p>
              <p className="font-mono font-black text-lg tracking-widest bg-slate-100 rounded-xl py-2 mt-3">
                {resultado.cupom.codigo_cupom}
              </p>
              <p className="text-xs text-iub-cinza mt-2">Válido até {formatarValidade(resultado.cupom.valido_ate)}</p>
            </div>

            <div className="flex flex-col gap-2 mt-5">
              <Link to="/meu/cupons" className="btn-iub-primary text-sm py-2.5">Ver meus cupons</Link>
              <button type="button" onClick={() => setResultado(null)} className="text-iub-cinza text-sm py-1">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import MascoteIubMais from '../../../components/MascoteIubMais';
import { NIVEIS } from './memoriaConfig';

function formatarTempo(segundos) {
  if (segundos == null) return '--:--';
  const m = Math.floor(segundos / 60).toString().padStart(2, '0');
  const s = Math.floor(segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Landing de seleção de nível — GET /public/memoria/niveis é a fonte de
// verdade de desbloqueado/completado (nível 1 sempre livre, N>1 só se
// completou N-1); NIVEIS local só tem o que é estático (nome/emoji/cols).
export default function MemoriaNiveis() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [niveis, setNiveis] = useState([]);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/jogar/login', { replace: true }); return; }
    apiPainel.get('/public/memoria/niveis')
      .then(res => setNiveis(res.data.niveis))
      .catch(err => {
        if (err.response?.status === 401) navigate('/jogar/login', { replace: true });
        else console.error('Erro ao carregar níveis da memória:', err);
      })
      .finally(() => setCarregando(false));
  }, [navigate]);

  const completados = niveis.filter(n => n.completado).length;

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
      <header className="text-center pt-8 px-4">
        <h1 className="text-3xl sm:text-4xl font-black text-white">🧠 JOGO DA MEMÓRIA</h1>
        <p className="text-iub-dourado font-black uppercase text-xs sm:text-sm mt-2 tracking-wide">
          Escolha seu nível
        </p>
      </header>

      <div className="max-w-md mx-auto px-4 mt-5">
        <div className="bg-white/10 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full bg-iub-dourado rounded-full transition-all duration-500"
            style={{ width: `${(completados / NIVEIS.length) * 100}%` }}
          />
        </div>
        <p className="text-white/80 text-xs text-center mt-2 font-semibold">
          Você completou {completados} de {NIVEIS.length} níveis!
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-3">
        {niveis.map(nivel => (
          <CardNivel key={nivel.nivel} nivel={nivel} onJogar={() => navigate(`/jogar/memoria/${nivel.nivel}`)} />
        ))}
      </div>
    </div>
  );
}

function CardNivel({ nivel, onJogar }) {
  const cfg = NIVEIS.find(n => n.nivel === nivel.nivel);
  const bloqueado = !nivel.desbloqueado;

  // Nível de destaque (LENDARIO) ganha uma moldura em gradiente roxo→dourado
  // pra se distinguir dos outros na lista — só quando já está desbloqueado,
  // senão o cadeado perderia a leitura de "bloqueado".
  const destaque = cfg.destaque && !bloqueado;

  return (
    <div
      className={`rounded-2xl p-4 flex items-center gap-3 transition-colors ${
        bloqueado ? 'bg-white/5' : nivel.completado ? 'bg-white' : 'bg-white/95'
      }`}
      style={destaque ? {
        background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 62%, #FFF6DE 100%)',
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, #4C1D95 0%, #FFB800 100%)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      } : undefined}
    >
      <div className={`text-3xl sm:text-4xl shrink-0 ${bloqueado ? 'grayscale opacity-40' : ''}`}>{cfg.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className={`font-black text-sm sm:text-base truncate ${bloqueado ? 'text-white/40' : 'text-iub-roxo'}`}>
          NÍVEL {nivel.nivel} — {cfg.nome}
        </p>
        <p className={`text-xs ${bloqueado ? 'text-white/30' : 'text-iub-cinza'}`}>
          {cfg.pares} pares ({cfg.dimensoes})
        </p>
        {nivel.completado ? (
          <p className="text-xs font-bold text-emerald-600 mt-0.5">✅ Melhor tempo: {formatarTempo(nivel.melhor_tempo_segundos)}</p>
        ) : bloqueado ? (
          <p className="text-xs font-semibold text-white/40 mt-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Complete o nível {nivel.nivel - 1}
          </p>
        ) : (
          <p className="text-xs font-bold text-iub-roxo-medio mt-0.5">🆕 Disponível!</p>
        )}
      </div>
      <button
        type="button"
        onClick={onJogar}
        disabled={bloqueado}
        className="btn-iub-dourado text-xs sm:text-sm px-4 py-2 shrink-0 disabled:opacity-30 disabled:pointer-events-none disabled:grayscale"
      >
        {bloqueado ? <Lock className="w-4 h-4" /> : nivel.completado ? 'JOGAR DE NOVO' : 'JOGAR'}
      </button>
    </div>
  );
}

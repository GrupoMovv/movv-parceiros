import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import MascoteIubMais from '../../../components/MascoteIubMais';
import MemoriaCarta from './components/MemoriaCarta';

// Temas mistos do grid — 4 parceiros ativos, o mascote e 3 símbolos IUB
// (❤️⭐🎁), igual RoletaWheel hardcoda seus 8 setores: são assets
// promocionais fixos, não dado de negócio pra buscar do banco a cada
// carregamento. Só 2 dos 10 parceiros da Roleta têm logo_url cadastrada
// hoje (nossa-drogaria, imaginari-personalizados) — os outros 2 aqui
// usam badge de sigla+cor em vez de logo quebrada (ver TODO.md: "várias
// poses" do mascote também não existe ainda, só 1 imagem oficial).
const PARES = [
  { chave: 'nossa-drogaria', tipo: 'parceiro', nome: 'Drogaria Sindical', logo: 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788459943/iubmais/parceiros/1/logo/ipgi7gljwt7woyo0lqp1.png' },
  { chave: 'imaginari-personalizados', tipo: 'parceiro', nome: 'Imaginari Personalizados', logo: 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789000890/iubmais/parceiros/14/logo/qqmbgroahvivdxgfe8ym.jpg' },
  { chave: 'academia-atletica', tipo: 'parceiro', nome: 'Academia Atlética', sigla: 'AA', cor: '#EF4444' },
  { chave: 'oticas-diniz', tipo: 'parceiro', nome: 'Óticas Diniz', sigla: 'OD', cor: '#0EA5E9' },
  { chave: 'mascote', tipo: 'mascote', nome: 'Mascote IUB MAIS+' },
  { chave: 'coracao', tipo: 'simbolo', emoji: '❤️', nome: 'Coração' },
  { chave: 'estrela', tipo: 'simbolo', emoji: '⭐', nome: 'Estrela' },
  { chave: 'presente', tipo: 'simbolo', emoji: '🎁', nome: 'Presente' },
];

function embaralhar(itens) {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function criarBaralho() {
  const cartas = PARES.flatMap((par, i) => [{ ...par, uid: `${i}-a` }, { ...par, uid: `${i}-b` }]);
  return embaralhar(cartas);
}

function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0');
  const s = Math.floor(segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Sintetiza um beep curto via Web Audio — sem depender de arquivo de som
// (nenhum existe no projeto ainda). Falha em silêncio se o navegador
// bloquear autoplay de áudio ou não suportar a API; som é só um extra,
// nunca pode travar o jogo.
let audioCtxSingleton = null;
function tocarSom(freq, duracao = 0.12) {
  try {
    audioCtxSingleton = audioCtxSingleton || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxSingleton;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracao);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duracao);
  } catch {
    // Web Audio indisponível/bloqueado — segue o jogo sem som.
  }
}

function dispararConfeteVitoria() {
  const duracao = 1800;
  const fim = Date.now() + duracao;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: ['#FFB800', '#7C3AED', '#A855F7'] });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: ['#FFB800', '#7C3AED', '#A855F7'] });
    if (Date.now() < fim) requestAnimationFrame(frame);
  })();
}

export default function Memoria() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [somLigado, setSomLigado] = useState(() => {
    try { return localStorage.getItem('iub_memoria_som') !== 'off'; } catch { return true; }
  });

  const [baralho, setBaralho] = useState(criarBaralho);
  const [viradas, setViradas] = useState([]);
  const [casadas, setCasadas] = useState(new Set());
  const [travado, setTravado] = useState(false);
  const [jogadas, setJogadas] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [iniciado, setIniciado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [vencido, setVencido] = useState(false);

  const [melhorTempoPessoal, setMelhorTempoPessoal] = useState(null);
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [ranking, setRanking] = useState({ dia: null, semana: null });
  const [abaRanking, setAbaRanking] = useState('dia');
  // Status da Roleta só pra decidir o botão "voltar pra roleta" no modal
  // de vitória — não bloqueia o carregamento da Memória (jogo funciona
  // mesmo se essa chamada falhar, por isso catch silencioso).
  const [roletaStatus, setRoletaStatus] = useState(null);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/jogar/login', { replace: true }); return; }
    apiPainel.get('/public/memoria/meu-recorde')
      .then(res => setMelhorTempoPessoal(res.data.melhor_tempo_segundos))
      .catch(err => {
        if (err.response?.status === 401) navigate('/jogar/login', { replace: true });
        else console.error('Erro ao carregar recorde da memória:', err);
      })
      .finally(() => setCarregando(false));
    apiPainel.get('/public/roleta/status').then(res => setRoletaStatus(res.data)).catch(() => {});
  }, [navigate]);

  // Cronômetro — só roda depois da 1ª carta virada, para de rodar
  // pausado ou vencido.
  useEffect(() => {
    if (!iniciado || pausado || vencido) return;
    const id = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [iniciado, pausado, vencido]);

  // Detecta vitória (8 duplas encontradas) e grava a partida.
  useEffect(() => {
    if (vencido || casadas.size < PARES.length) return;
    setVencido(true);
    if (somLigado) {
      tocarSom(880, 0.18);
      setTimeout(() => tocarSom(1108, 0.22), 140);
      setTimeout(() => tocarSom(1318, 0.32), 280);
    }
    dispararConfeteVitoria();

    apiPainel.post('/public/memoria/partida', { tempo_segundos: segundos, jogadas })
      .then(res => {
        setResultadoFinal(res.data);
        return apiPainel.get('/public/memoria/ranking', { params: { periodo: 'dia' } });
      })
      .then(res => setRanking(r => ({ ...r, dia: res.data })))
      .catch(err => console.error('Erro ao registrar partida da memória:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casadas]);

  function alternarSom() {
    setSomLigado(ligado => {
      const novo = !ligado;
      try { localStorage.setItem('iub_memoria_som', novo ? 'on' : 'off'); } catch { /* localStorage indisponível */ }
      return novo;
    });
  }

  async function carregarRankingSemana() {
    if (ranking.semana) return;
    try {
      const res = await apiPainel.get('/public/memoria/ranking', { params: { periodo: 'semana' } });
      setRanking(r => ({ ...r, semana: res.data }));
    } catch (err) {
      console.error('Erro ao carregar ranking da semana:', err);
    }
  }

  function virarCarta(carta) {
    if (pausado || travado || vencido) return;
    if (viradas.includes(carta.uid) || casadas.has(carta.chave) || viradas.length === 2) return;
    if (!iniciado) setIniciado(true);
    if (somLigado) tocarSom(440, 0.08);

    const novasViradas = [...viradas, carta.uid];
    setViradas(novasViradas);
    if (novasViradas.length < 2) return;

    setJogadas(j => j + 1);
    const [c1, c2] = novasViradas.map(uid => baralho.find(c => c.uid === uid));
    if (c1.chave === c2.chave) {
      setTimeout(() => {
        if (somLigado) tocarSom(660, 0.15);
        setCasadas(prev => new Set(prev).add(c1.chave));
        setViradas([]);
      }, 500);
    } else {
      setTravado(true);
      setTimeout(() => { setViradas([]); setTravado(false); }, 900);
    }
  }

  function reiniciar() {
    setBaralho(criarBaralho());
    setViradas([]);
    setCasadas(new Set());
    setTravado(false);
    setJogadas(0);
    setSegundos(0);
    setIniciado(false);
    setPausado(false);
    setVencido(false);
    setResultadoFinal(null);
    setRanking({ dia: null, semana: null });
    setAbaRanking('dia');
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
      <header className="text-center pt-8 px-4">
        <h1 className="text-3xl sm:text-4xl font-black text-white">🧠 JOGO DA MEMÓRIA</h1>
        <p className="text-iub-dourado font-black uppercase text-xs sm:text-sm mt-2 tracking-wide">
          Sem limite — joga quantas vezes quiser!
        </p>
      </header>

      {/* HUD */}
      <div className="max-w-md mx-auto mt-5 px-4">
        <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 text-white">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Tempo</p>
            <p className="font-black font-mono text-lg">{formatarTempo(segundos)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Jogadas</p>
            <p className="font-black text-lg">{jogadas}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Seu recorde</p>
            <p className="font-black text-lg text-iub-dourado">
              {melhorTempoPessoal != null ? formatarTempo(melhorTempoPessoal) : '--:--'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPausado(p => !p)}
              disabled={!iniciado || vencido}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-40"
              aria-label={pausado ? 'Continuar' : 'Pausar'}
            >
              {pausado ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={reiniciar}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label="Reiniciar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={alternarSom}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label={somLigado ? 'Desligar som' : 'Ligar som'}
            >
              {somLigado ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="relative max-w-sm sm:max-w-md mx-auto mt-5 px-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {baralho.map(carta => (
            <MemoriaCarta
              key={carta.uid}
              carta={carta}
              virada={viradas.includes(carta.uid)}
              casada={casadas.has(carta.chave)}
              desabilitada={pausado || vencido}
              onClick={() => virarCarta(carta)}
            />
          ))}
        </div>

        {pausado && (
          <div className="absolute inset-0 bg-iub-roxo-escuro/90 rounded-2xl flex flex-col items-center justify-center gap-3">
            <p className="text-white font-black text-xl">⏸️ PAUSADO</p>
            <button type="button" onClick={() => setPausado(false)} className="btn-iub-dourado px-8 py-2.5">
              Continuar
            </button>
          </div>
        )}
      </div>

      {vencido && resultadoFinal && (
        <ModalVitoria
          resultadoFinal={resultadoFinal}
          jogadas={jogadas}
          ranking={ranking}
          abaRanking={abaRanking}
          roletaStatus={roletaStatus}
          onMudarAba={aba => { setAbaRanking(aba); if (aba === 'semana') carregarRankingSemana(); }}
          onJogarDeNovo={reiniciar}
        />
      )}
    </div>
  );
}

function ModalVitoria({ resultadoFinal, jogadas, ranking, abaRanking, roletaStatus, onMudarAba, onJogarDeNovo }) {
  const dados = ranking[abaRanking];
  // "Voltar pra roleta" só faz sentido em 2 casos: (a) já jogou hoje e tem
  // cupom esperando — manda ver ele; (b) ainda não jogou e tem parceiro
  // elegível — manda girar. Se não tem como jogar hoje (o motivo que
  // provavelmente trouxe o associado pra Memória), não mostra o botão.
  let botaoRoleta = null;
  if (roletaStatus && !roletaStatus.pode_jogar) {
    botaoRoleta = { to: '/meu/cupons', label: '🎟️ Ver meu cupom' };
  } else if (roletaStatus && roletaStatus.pode_jogar && roletaStatus.tem_parceiros_disponiveis) {
    botaoRoleta = { to: '/jogar/roleta', label: '🎡 Ir girar a roleta' };
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <MascoteIubMais tamanho="medium" animacao="bounce" className="mx-auto" />
        <h2 className="text-2xl font-black text-iub-roxo mt-2">🎉 VOCÊ CONSEGUIU!</h2>

        {resultadoFinal.novo_recorde && (
          <p className="inline-block bg-iub-dourado text-black font-black text-xs uppercase tracking-wide px-3 py-1 rounded-full mt-2">
            🏆 Novo recorde pessoal!
          </p>
        )}

        <div className="flex justify-center gap-6 mt-4">
          <div>
            <p className="text-xs text-iub-cinza">Tempo</p>
            <p className="text-2xl font-black text-iub-roxo-escuro">{formatarTempo(resultadoFinal.partida.tempo_segundos)}</p>
          </div>
          <div>
            <p className="text-xs text-iub-cinza">Jogadas</p>
            <p className="text-2xl font-black text-iub-roxo-escuro">{jogadas}</p>
          </div>
        </div>

        {/* Ranking */}
        <div className="mt-5 text-left">
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => onMudarAba('dia')}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${abaRanking === 'dia' ? 'bg-white text-iub-roxo shadow' : 'text-iub-cinza'}`}
            >
              Top 10 hoje
            </button>
            <button
              type="button"
              onClick={() => onMudarAba('semana')}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${abaRanking === 'semana' ? 'bg-white text-iub-roxo shadow' : 'text-iub-cinza'}`}
            >
              Top 10 semana
            </button>
          </div>

          {!dados ? (
            <p className="text-center text-xs text-iub-cinza mt-3">Carregando ranking...</p>
          ) : (
            <>
              <ol className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                {dados.top10.map((item, i) => (
                  <li key={item.associado_id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className="font-semibold text-iub-roxo-escuro truncate mr-2">
                      {i + 1}º {item.nome_completo}
                    </span>
                    <span className="font-mono font-bold text-iub-cinza shrink-0">{formatarTempo(item.melhor_tempo_segundos)}</span>
                  </li>
                ))}
                {dados.top10.length === 0 && (
                  <li className="text-center text-xs text-iub-cinza py-2">Ninguém jogou ainda — seja o 1º!</li>
                )}
              </ol>
              {dados.minha_posicao && (
                <p className="text-center text-xs text-iub-roxo font-bold mt-2">
                  Sua posição: {dados.minha_posicao.posicao}º ({formatarTempo(dados.minha_posicao.melhor_tempo_segundos)})
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={onJogarDeNovo} className="btn-iub-dourado text-sm py-2.5">
            🔁 Jogar novamente
          </button>
          {botaoRoleta && (
            <Link to={botaoRoleta.to} className="btn-iub-outline text-sm py-2.5">
              {botaoRoleta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

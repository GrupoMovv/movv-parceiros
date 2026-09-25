import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import MascoteIubMais, { MASCOTE_URL } from '../../../components/MascoteIubMais';
import MemoriaCarta from './components/MemoriaCarta';
import { getNivelConfig, POOL_PARES } from './memoriaConfig';

function embaralhar(itens) {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Sorteia `qtd` temas do pool de 18 a cada partida (níveis menores não
// usam o pool inteiro) — dá variedade entre partidas repetidas do mesmo
// nível, já que o jogo é "sem limite, joga quanto quiser".
function criarBaralho(qtd) {
  const paresEscolhidos = embaralhar(POOL_PARES).slice(0, qtd);
  const cartas = paresEscolhidos.flatMap((par, i) => [{ ...par, uid: `${i}-a` }, { ...par, uid: `${i}-b` }]);
  return embaralhar(cartas);
}

function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0');
  const s = Math.floor(segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Poses do mascote por nível, só com filtro CSS na mesma imagem (não
// existe arte de pose diferente ainda) — 1-2 fácil/normal, 3 "pensativo"
// (leve dessaturação + inclinação), 4-5 "determinado" (contraste/brilho
// dourado mais forte).
function estiloMascotePorNivel(nivel) {
  if (nivel <= 2) return {};
  if (nivel === 3) return { filter: 'grayscale(30%) contrast(1.05)', transform: 'rotate(-4deg)' };
  return { filter: 'contrast(1.25) saturate(1.35) drop-shadow(0 0 12px rgba(255,184,0,0.55))' };
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
  const { nivel: nivelParam } = useParams();
  const nivel = Number(nivelParam);
  const cfg = getNivelConfig(nivel);

  const [carregando, setCarregando] = useState(true);
  const [desbloqueado, setDesbloqueado] = useState(true);
  const [somLigado, setSomLigado] = useState(() => {
    try { return localStorage.getItem('iub_memoria_som') !== 'off'; } catch { return true; }
  });

  const [baralho, setBaralho] = useState(() => (cfg ? criarBaralho(cfg.pares) : []));
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

  // Nível inválido na URL (não é 1-5) — manda pra seleção de nível.
  useEffect(() => {
    if (!cfg) navigate('/jogar/memoria', { replace: true });
  }, [cfg, navigate]);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/entrar?voltar=/jogar/memoria', { replace: true }); return; }
    if (!cfg) return;
    apiPainel.get('/public/memoria/niveis')
      .then(res => {
        const info = res.data.niveis.find(n => n.nivel === nivel);
        setDesbloqueado(info?.desbloqueado ?? false);
        setMelhorTempoPessoal(info?.melhor_tempo_segundos ?? null);
        if (info && !info.desbloqueado) navigate('/jogar/memoria', { replace: true });
      })
      .catch(err => {
        if (err.response?.status === 401) navigate('/entrar?voltar=/jogar/memoria', { replace: true });
        else console.error('Erro ao carregar nível da memória:', err);
      })
      .finally(() => setCarregando(false));
    apiPainel.get('/public/roleta/status').then(res => setRoletaStatus(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, nivel]);

  // Cronômetro — só roda depois da 1ª carta virada, para de rodar
  // pausado ou vencido.
  useEffect(() => {
    if (!iniciado || pausado || vencido) return;
    const id = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [iniciado, pausado, vencido]);

  // Detecta vitória (todas as duplas do nível encontradas) e grava a partida.
  useEffect(() => {
    if (!cfg || vencido || casadas.size < cfg.pares) return;
    setVencido(true);
    if (somLigado) {
      tocarSom(880, 0.18);
      setTimeout(() => tocarSom(1108, 0.22), 140);
      setTimeout(() => tocarSom(1318, 0.32), 280);
    }
    dispararConfeteVitoria();

    apiPainel.post('/public/memoria/partida', { tempo_segundos: segundos, jogadas, nivel })
      .then(res => {
        setResultadoFinal(res.data);
        if (res.data.nivel_desbloqueado && somLigado) setTimeout(() => tocarSom(1568, 0.4), 500);
        return apiPainel.get('/public/memoria/ranking', { params: { periodo: 'dia', nivel } });
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
      const res = await apiPainel.get('/public/memoria/ranking', { params: { periodo: 'semana', nivel } });
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
    if (!cfg) return;
    setBaralho(criarBaralho(cfg.pares));
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

  // Troca de nível (ex.: botão "Próximo Nível") reusa a mesma instância
  // do componente — precisa resetar tudo pro novo `nivel`/`cfg`.
  useEffect(() => {
    if (cfg) reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel]);

  if (!cfg) return null;

  if (carregando || !desbloqueado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro">
        <MascoteIubMais tamanho="medium" animacao="pulse" />
        <p className="text-white/80 mt-4">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro pb-16">
      <header className="text-center pt-5 sm:pt-8 px-4">
        <Link to="/jogar/memoria" className="text-white/60 hover:text-white text-xs underline">← Todos os níveis</Link>
        <h1 className="text-xl sm:text-4xl font-black text-white mt-1.5 sm:mt-2">
          {cfg.emoji} NÍVEL {cfg.nivel} — {cfg.nome}
        </h1>
        <p className="text-iub-dourado font-black uppercase text-xs sm:text-sm mt-1 sm:mt-2 tracking-wide">
          {cfg.pares} pares · {cfg.dimensoes}
        </p>
      </header>

      {/* HUD — mais compacto no mobile (item 8: sobra de espaço vertical
          nos níveis com mais linhas); sm: preserva o tamanho original. */}
      <div className="max-w-md mx-auto mt-3 sm:mt-5 px-4">
        <div className="bg-white/10 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2 text-white">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Tempo</p>
            <p className="font-black font-mono text-base sm:text-lg">{formatarTempo(segundos)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Jogadas</p>
            <p className="font-black text-base sm:text-lg">{jogadas}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Seu recorde</p>
            <p className="font-black text-base sm:text-lg text-iub-dourado">
              {melhorTempoPessoal != null ? formatarTempo(melhorTempoPessoal) : '--:--'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPausado(p => !p)}
              disabled={!iniciado || vencido}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-40"
              aria-label={pausado ? 'Continuar' : 'Pausar'}
            >
              {pausado ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={reiniciar}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label="Reiniciar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={alternarSom}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label={somLigado ? 'Desligar som' : 'Ligar som'}
            >
              {somLigado ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-2 sm:mt-3">
        <img
          src={MASCOTE_URL}
          alt=""
          className="w-10 h-10 sm:w-14 sm:h-14 object-contain animate-float"
          style={estiloMascotePorNivel(nivel)}
        />
      </div>

      {/* Grid — cols dinâmico (4/5/6) não dá pra fazer só com classe
          Tailwind estática (o purge do build não conhece `grid-cols-${n}`
          gerado em runtime), por isso gridTemplateColumns via style.
          Nível 1 (4 cols) mantém o container max-w-sm original — já
          ficava bem distribuído. Níveis 2-5 (5-6 cols) usam quase 100% da
          largura no mobile: o max-w-sm (384px) capava o tamanho da carta
          em qualquer tela ≥384px, então um iPhone Pro Max (428px) via as
          mesmas cartas pequenas de um iPhone SE — sobrava tela vazia nas
          bordas em vez de cartas maiores. */}
      <div className={`relative mx-auto mt-3 sm:mt-4 sm:max-w-lg sm:px-4 ${cfg.cols > 4 ? 'px-3' : 'max-w-sm px-4'}`}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))`,
            gap: cfg.cols >= 6 ? '6px' : cfg.cols === 5 ? '8px' : '10px',
          }}
        >
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
          cfg={cfg}
          resultadoFinal={resultadoFinal}
          jogadas={jogadas}
          ranking={ranking}
          abaRanking={abaRanking}
          roletaStatus={roletaStatus}
          onMudarAba={aba => { setAbaRanking(aba); if (aba === 'semana') carregarRankingSemana(); }}
          onJogarDeNovo={reiniciar}
          onProximoNivel={() => navigate(`/jogar/memoria/${nivel + 1}`)}
        />
      )}
    </div>
  );
}

function ModalVitoria({ cfg, resultadoFinal, jogadas, ranking, abaRanking, roletaStatus, onMudarAba, onJogarDeNovo, onProximoNivel }) {
  const dados = ranking[abaRanking];
  const proximoNivel = getNivelConfig(cfg.nivel + 1);

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
        <p className="text-iub-cinza text-xs mt-0.5">{cfg.emoji} Nível {cfg.nivel} — {cfg.nome}</p>

        {resultadoFinal.nivel_desbloqueado && (
          <p className="inline-block bg-emerald-500 text-white font-black text-xs uppercase tracking-wide px-3 py-1.5 rounded-full mt-3 animate-pulse-slow">
            🎊 Você desbloqueou o Nível {resultadoFinal.nivel_desbloqueado}!
          </p>
        )}
        {resultadoFinal.novo_recorde && (
          <p className="inline-block bg-iub-dourado text-black font-black text-xs uppercase tracking-wide px-3 py-1 rounded-full mt-2 ml-1">
            🏆 Novo recorde!
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
          <div>
            <p className="text-xs text-iub-cinza">Seu recorde</p>
            <p className="text-2xl font-black text-iub-dourado-escuro">{formatarTempo(resultadoFinal.melhor_tempo_pessoal)}</p>
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
                  <li
                    key={item.associado_id}
                    className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${item.eu ? 'bg-iub-dourado/20 ring-1 ring-iub-dourado' : 'bg-slate-50'}`}
                  >
                    <span className="font-semibold text-iub-roxo-escuro truncate mr-2">
                      {i + 1}º {item.nome}{item.eu && ' (Você)'}
                    </span>
                    <span className="font-mono font-bold text-iub-cinza shrink-0">{formatarTempo(item.melhor_tempo_segundos)}</span>
                  </li>
                ))}
                {dados.top10.length === 0 && (
                  <li className="text-center text-xs text-iub-cinza py-2">Ninguém jogou esse nível ainda — seja o 1º!</li>
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
          {proximoNivel && (
            <button type="button" onClick={onProximoNivel} className="btn-iub-primary text-sm py-2.5">
              {proximoNivel.emoji} Próximo nível: {proximoNivel.nome} →
            </button>
          )}
          <button type="button" onClick={onJogarDeNovo} className="btn-iub-dourado text-sm py-2.5">
            🔁 Jogar novamente
          </button>
          {botaoRoleta && (
            <Link to={botaoRoleta.to} className="btn-iub-outline text-sm py-2.5">
              {botaoRoleta.label}
            </Link>
          )}
          <Link to="/jogar/memoria" className="text-iub-cinza text-xs py-1 underline">
            Ver todos os níveis
          </Link>
        </div>
      </div>
    </div>
  );
}

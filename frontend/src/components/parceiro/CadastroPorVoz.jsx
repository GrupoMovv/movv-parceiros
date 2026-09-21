import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mic, Square, Loader2, X, RotateCcw } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../../pages/public/Marketplace/theme';

const DURACAO_MAX_S = 60;
const DURACAO_MIN_S = 1.5;
// Ordem importa: Chrome/Firefox gravam webm/ogg, Safari/iOS só mp4. O
// backend (openaiService.EXTENSAO_AUDIO) aceita todos esses.
const MIME_CANDIDATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const EXEMPLOS = [
  'X-Bacon com bacon crocante e batata palha. Vinte e nove reais e noventa.',
  'Marmita executiva de contrafilé com arroz, feijão e salada. Vinte e cinco reais.',
  'Pizza grande de calabresa, borda recheada com catupiry. Sessenta reais.',
];

function escolherMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATOS.find(m => MediaRecorder.isTypeSupported?.(m)) || '';
}

function extensaoDoTipo(tipo) {
  if (tipo.includes('mp4')) return 'mp4';
  if (tipo.includes('ogg')) return 'ogg';
  return 'webm';
}

function formatarTempo(s) {
  const seg = Math.floor(s);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

// Botão "🎤 Falar pra cadastrar" + modal: grava (MediaRecorder) -> envia
// pro backend (Whisper + GPT-4o, POST /parceiro/produtos/cadastrar-por-voz)
// -> `onConfirmar` devolve nome/descrição/preço/categoria/tempo pro
// ProdutoForm preencher. Igual IACadastroProduto: nunca salva produto
// sozinho, o comerciante confere no formulário e clica Publicar.
export default function CadastroPorVoz({ onConfirmar, autoAbrir = false }) {
  const [fase, setFase] = useState('fechado'); // fechado | pronto | gravando | processando | erro | limite
  const [segundos, setSegundos] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [etapa, setEtapa] = useState('Escutando seu produto...');
  const [erro, setErro] = useState(null); // { mensagem, transcricao }
  const [limite, setLimite] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const canceladoRef = useRef(false);

  useEffect(() => { if (autoAbrir) setFase('pronto'); }, [autoAbrir]);

  // Desmontou no meio da gravação (trocou de aba do painel etc.) — solta
  // o microfone, senão a bolinha vermelha de "gravando" fica no navegador.
  useEffect(() => () => { canceladoRef.current = true; liberarRecursos(); }, []);

  function liberarRecursos() {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function fechar() {
    canceladoRef.current = true;
    liberarRecursos();
    setFase('fechado'); setSegundos(0); setNivel(0); setErro(null); setLimite(null);
  }

  // Medidor de volume simples (não é waveform de verdade) — serve pro
  // comerciante ver que o microfone está captando a voz dele.
  function iniciarMedidor(stream) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    const dados = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(dados);
      let soma = 0;
      for (const v of dados) soma += ((v - 128) / 128) ** 2;
      setNivel(Math.min(1, Math.sqrt(soma / dados.length) * 4));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }

  async function iniciarGravacao() {
    const mime = escolherMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      setErro({ mensagem: 'Seu navegador não permite gravar áudio. Atualize o navegador ou use o Chrome.' });
      setFase('erro');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      setErro({
        mensagem: err?.name === 'NotAllowedError'
          ? 'Você precisa permitir o uso do microfone. Toque no cadeado ao lado do endereço do site e libere o microfone.'
          : err?.name === 'NotFoundError' ? 'Nenhum microfone encontrado neste aparelho.' : 'Não foi possível acessar o microfone.',
      });
      setFase('erro');
      return;
    }

    canceladoRef.current = false;
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = recorder;
    const partes = [];
    const inicio = Date.now();

    recorder.ondataavailable = e => { if (e.data?.size) partes.push(e.data); };
    recorder.onstop = () => {
      const duracao = (Date.now() - inicio) / 1000;
      liberarRecursos();
      if (canceladoRef.current) return;
      if (duracao < DURACAO_MIN_S) {
        setErro({ mensagem: 'Gravação muito curta. Segure e fale o nome, o que vem no produto e o preço.' });
        setFase('erro');
        return;
      }
      const tipo = recorder.mimeType || mime || 'audio/webm';
      enviar(new Blob(partes, { type: tipo }), tipo);
    };

    recorder.start(250);
    iniciarMedidor(stream);
    setSegundos(0);
    setFase('gravando');
    timerRef.current = setInterval(() => {
      const s = (Date.now() - inicio) / 1000;
      setSegundos(s);
      if (s >= DURACAO_MAX_S) pararGravacao();
    }, 200);
  }

  function pararGravacao() {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function enviar(blob, tipo) {
    setFase('processando');
    setEtapa('Escutando seu produto...');
    // Uma chamada só faz as duas etapas no backend (Whisper e depois
    // GPT-4o) — o texto troca por tempo, é só pro comerciante saber que
    // não travou.
    const trocaEtapa = setTimeout(() => setEtapa('Estruturando com IA...'), 2500);
    try {
      const fd = new FormData();
      fd.append('audio', blob, `produto.${extensaoDoTipo(tipo)}`);
      const res = await apiParceiro.post('/parceiro/produtos/cadastrar-por-voz', fd, { timeout: 60000 });
      if (canceladoRef.current) return;
      onConfirmar?.(res.data);
      toast.success(res.data.preco ? 'Pronto! Confira os dados e clique em Publicar.' : 'Pronto! Só faltou o preço — preencha e clique em Publicar.', { duration: 5000 });
      fechar();
    } catch (err) {
      if (canceladoRef.current) return;
      const d = err.response?.data;
      if (err.response?.status === 403 && d?.codigo === 'LIMITE_ATINGIDO') {
        setLimite(d);
        setFase('limite');
        return;
      }
      setErro({ mensagem: d?.error || (err.code === 'ECONNABORTED' ? 'Demorou demais pra responder. Tente de novo.' : 'Não foi possível processar o áudio agora.'), transcricao: d?.transcricao });
      setFase('erro');
    } finally {
      clearTimeout(trocaEtapa);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFase('pronto')}
        className="w-full flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wide px-6 py-4 rounded-2xl shadow-lg text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
        style={{ backgroundColor: ROXO }}
      >
        <Mic className="w-5 h-5" /> Falar pra cadastrar
      </button>

      {fase !== 'fechado' && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
            <button type="button" onClick={fechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <X className="w-4 h-4" />
            </button>

            {fase === 'pronto' && (
              <div className="text-center pt-2">
                <h2 className="font-black text-lg" style={{ color: PRETO }}>Fale o produto</h2>
                <p className="text-slate-500 text-sm mt-1">Diga o <b>nome</b>, <b>o que vem nele</b> e o <b>preço</b>. A IA preenche o resto.</p>
                <button
                  type="button"
                  onClick={iniciarGravacao}
                  aria-label="Começar a gravar"
                  className="w-28 h-28 rounded-full mx-auto my-7 flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: ROXO }}
                >
                  <Mic className="w-12 h-12" />
                </button>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Exemplos</p>
                <ul className="space-y-1.5 text-left">
                  {EXEMPLOS.map(ex => (
                    <li key={ex} className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">“{ex}”</li>
                  ))}
                </ul>
              </div>
            )}

            {fase === 'gravando' && (
              <div className="text-center pt-2">
                <p className="flex items-center justify-center gap-2 font-bold text-sm text-red-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Gravando
                </p>
                <p className="font-black text-3xl mt-2 tabular-nums" style={{ color: PRETO }}>
                  {formatarTempo(segundos)} <span className="text-sm font-semibold text-slate-400">/ {formatarTempo(DURACAO_MAX_S)}</span>
                </p>
                <div className="flex items-end justify-center gap-1.5 h-16 my-6" aria-hidden="true">
                  {[0.5, 0.8, 1, 0.8, 0.5].map((peso, i) => (
                    <span
                      key={i}
                      className="w-3 rounded-full transition-[height] duration-75"
                      style={{ height: `${12 + nivel * peso * 52}px`, backgroundColor: ROXO }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={pararGravacao}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold py-4 rounded-2xl text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" fill="currentColor" /> Parar gravação
                </button>
              </div>
            )}

            {fase === 'processando' && (
              <div className="text-center py-10">
                <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: ROXO }} />
                <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>{etapa}</p>
                <p className="text-slate-400 text-xs mt-1">Leva só alguns segundos</p>
              </div>
            )}

            {fase === 'erro' && erro && (
              <div className="text-center py-6">
                <p className="text-4xl">🎤</p>
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{erro.mensagem}</p>
                {erro.transcricao && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mt-3">Entendi: “{erro.transcricao}”</p>
                )}
                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={() => setFase('pronto')} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    <RotateCcw className="w-4 h-4" /> Tentar de novo
                  </button>
                  <button type="button" onClick={fechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    Cadastrar manualmente
                  </button>
                </div>
              </div>
            )}

            {fase === 'limite' && limite && (
              <div className="text-center py-6">
                <p className="text-4xl">🎯</p>
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{limite.error}</p>
                <p className="text-slate-400 text-xs mt-1 mb-5">Planos pagos têm mais cadastros por voz por dia.</p>
                <div className="flex flex-col gap-2">
                  <Link to="/parceiro/painel/planos" onClick={fechar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-[#0F0F14]" style={{ backgroundColor: DOURADO }}>
                    Ver planos
                  </Link>
                  <button type="button" onClick={fechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    Continuar manual
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

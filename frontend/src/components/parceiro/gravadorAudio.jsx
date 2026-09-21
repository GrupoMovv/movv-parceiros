import { useCallback, useEffect, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { ROXO, PRETO } from '../../pages/public/Marketplace/theme';

// Gravação de áudio compartilhada pelos cadastros por voz (rápida e
// guiada) — MediaRecorder + timer + medidor de volume + tratamento de
// permissão do microfone num lugar só.

// Ordem importa: Chrome/Firefox gravam webm/ogg, Safari/iOS só mp4. O
// backend (openaiService.EXTENSAO_AUDIO) aceita todos esses.
const MIME_CANDIDATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function escolherMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATOS.find(m => MediaRecorder.isTypeSupported?.(m)) || '';
}

function extensaoDoTipo(tipo) {
  if (tipo.includes('mp4')) return 'mp4';
  if (tipo.includes('ogg')) return 'ogg';
  return 'webm';
}

export function formatarTempo(s) {
  const seg = Math.floor(s);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

// Monta o FormData do jeito que os endpoints de voz esperam (campo "audio").
export function formDataDoAudio(gravacao, extras = {}) {
  const fd = new FormData();
  fd.append('audio', gravacao.blob, gravacao.nomeArquivo);
  for (const [k, v] of Object.entries(extras)) if (v !== undefined && v !== null) fd.append(k, v);
  return fd;
}

// iniciar() resolve quando a gravação PARA:
//   { blob, tipo, nomeArquivo } — gravou
//   null — cancelada (fechou o modal etc.)
// e rejeita com Error(mensagem amigável) se não deu pra gravar (sem
// permissão, sem microfone, navegador sem suporte, gravação curta demais).
export function useGravadorAudio() {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [nivel, setNivel] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const canceladoRef = useRef(false);

  const liberarRecursos = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  // Desmontou no meio da gravação — solta o microfone, senão a bolinha
  // vermelha de "gravando" fica no navegador.
  useEffect(() => () => { canceladoRef.current = true; liberarRecursos(); }, [liberarRecursos]);

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

  const parar = useCallback(() => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancelar = useCallback(() => {
    canceladoRef.current = true;
    liberarRecursos();
    setGravando(false);
    setSegundos(0);
    setNivel(0);
  }, [liberarRecursos]);

  async function iniciar({ maxSegundos = 60, minSegundos = 1.5, mensagemCurta = 'Gravação muito curta. Toque no microfone e fale com calma.' } = {}) {
    const mime = escolherMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Seu navegador não permite gravar áudio. Atualize o navegador ou use o Chrome.');
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      throw new Error(
        err?.name === 'NotAllowedError'
          ? 'Você precisa permitir o uso do microfone. Toque no cadeado ao lado do endereço do site e libere o microfone.'
          : err?.name === 'NotFoundError' ? 'Nenhum microfone encontrado neste aparelho.' : 'Não foi possível acessar o microfone.'
      );
    }

    canceladoRef.current = false;
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = recorder;
    const partes = [];
    const inicio = Date.now();

    const resultado = new Promise((resolve, reject) => {
      recorder.ondataavailable = e => { if (e.data?.size) partes.push(e.data); };
      recorder.onstop = () => {
        const duracao = (Date.now() - inicio) / 1000;
        liberarRecursos();
        setGravando(false);
        setNivel(0);
        if (canceladoRef.current) return resolve(null);
        if (duracao < minSegundos) return reject(new Error(mensagemCurta));
        const tipo = recorder.mimeType || mime || 'audio/webm';
        return resolve({ blob: new Blob(partes, { type: tipo }), tipo, nomeArquivo: `produto.${extensaoDoTipo(tipo)}` });
      };
    });

    recorder.start(250);
    iniciarMedidor(stream);
    setSegundos(0);
    setGravando(true);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - inicio) / 1000;
      setSegundos(s);
      if (s >= maxSegundos) parar();
    }, 200);

    return resultado;
  }

  return { gravando, segundos, nivel, iniciar, parar, cancelar };
}

// Bloco "● Gravando 0:07 / 1:00 + barrinhas + [Parar gravação]".
export function PainelGravacao({ gravador, maxSegundos }) {
  return (
    <div className="text-center pt-2">
      <p className="flex items-center justify-center gap-2 font-bold text-sm text-red-600">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Gravando
      </p>
      <p className="font-black text-3xl mt-2 tabular-nums" style={{ color: PRETO }}>
        {formatarTempo(gravador.segundos)} <span className="text-sm font-semibold text-slate-400">/ {formatarTempo(maxSegundos)}</span>
      </p>
      <div className="flex items-end justify-center gap-1.5 h-16 my-6" aria-hidden="true">
        {[0.5, 0.8, 1, 0.8, 0.5].map((peso, i) => (
          <span
            key={i}
            className="w-3 rounded-full transition-[height] duration-75"
            style={{ height: `${12 + gravador.nivel * peso * 52}px`, backgroundColor: ROXO }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={gravador.parar}
        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-4 rounded-2xl text-white bg-red-600 hover:bg-red-700 transition-colors"
      >
        <Square className="w-4 h-4" fill="currentColor" /> Parar gravação
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';

// Só câmera ao vivo, nunca upload de arquivo — pedido explícito (foto real
// da pessoa na hora, não uma foto qualquer escolhida da galeria).
export default function CapturaFoto({ onCapturar, fotoAtual }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [pronta, setPronta] = useState(false);
  const [preview, setPreview] = useState(fotoAtual?.previewUrl || null);

  const suportaCamera = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (!suportaCamera || preview) return;
    let cancelado = false;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false })
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setPronta(true);
        }
      })
      .catch(() => setErro('Não conseguimos acessar sua câmera. Verifique a permissão e tente novamente.'));

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  function pararCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function tirarFoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const lado = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    const offsetX = (video.videoWidth - lado) / 2;
    const offsetY = (video.videoHeight - lado) / 2;
    // espelha (selfie) pra combinar com o preview que a pessoa já viu no <video>
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, lado, lado, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      setPreview(previewUrl);
      pararCamera();
      onCapturar({ blob, previewUrl });
    }, 'image/jpeg', 0.9);
  }

  function tirarDeNovo() {
    setPreview(null);
    setPronta(false);
    onCapturar(null);
  }

  if (!suportaCamera) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-amber-800 text-sm font-medium">Este navegador não suporta câmera.</p>
        <p className="text-amber-700 text-xs mt-1">Use o Chrome ou o Safari no seu celular pra continuar.</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-sm font-medium">{erro}</p>
        <button onClick={() => setErro(null)} className="mt-3 text-red-600 text-sm underline">Tentar de novo</button>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="relative w-full max-w-[280px] aspect-square mx-auto rounded-full overflow-hidden border-4" style={{ borderColor: '#D4AF37' }}>
          <img src={preview} alt="Sua foto" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={tirarDeNovo} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Tirar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-[280px] aspect-square mx-auto rounded-full overflow-hidden bg-slate-900">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        <div className="absolute inset-2 rounded-full border-4 border-dashed pointer-events-none" style={{ borderColor: '#B8E62C' }} />
        {!pronta && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
            <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="text-center text-slate-400 text-xs">Alinhe seu rosto dentro do círculo</p>
      <div className="flex justify-center">
        <button
          onClick={tirarFoto}
          disabled={!pronta}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#B8E62C', color: '#0B1F3A' }}
        >
          <Camera className="w-4 h-4" /> Tirar foto
        </button>
      </div>
    </div>
  );
}


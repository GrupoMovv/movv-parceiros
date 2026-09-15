import { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import toast from 'react-hot-toast';
import { Camera, Check, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ROXO } from '../pages/public/Marketplace/theme';

// Botão + input file escondido + modal de crop (react-easy-crop) — usado em
// todo formulário que recebe imagem do parceiro (logo, foto de produto,
// foto de promoção). Existe porque o enquadramento manual era a maior
// fricção reportada por empresário testando o cadastro: "tem que ficar
// diminuindo a imagem e salvando pra ver se enquadra... às vezes fica
// fora" — sem isso, o parceiro precisava editar a imagem num app externo
// antes de conseguir subir ela certa.
//
// Sempre devolve um File JPEG comprimido (<=TAMANHO_ALVO_SAIDA na imensa
// maioria dos casos — ver getRecorteComoBlob) pelo `onCropComplete`, então
// quem usa este componente não precisa mudar nada no upload em si: é só
// trocar o `<input type="file">` por isso e continuar mandando o File pro
// mesmo endpoint de sempre.

const FORMATOS_MIME_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_HEIC = /\.(heic|heif)$/i;
const TAMANHO_MAX_ORIGINAL = 10 * 1024 * 1024; // 10MB
const TAMANHO_MIN_ORIGINAL = 100 * 1024; // 100KB — só aviso, não bloqueia (igual ao padrão já usado pra dimensão pequena em Perfil.jsx/ProdutoForm.jsx)
const DIMENSAO_MINIMA = 400;
const LADO_MAXIMO_SAIDA = 1200;
const QUALIDADE_INICIAL = 0.85;
const QUALIDADE_MINIMA = 0.5;
const TAMANHO_ALVO_SAIDA = 500 * 1024; // 500KB

// Zoom começando no piso (1) deixava o slider sem folga pra diminuir —
// pra fotos não-quadradas o lado maior já "estoura" o quadro no zoom
// mínimo de antes, sem nenhum jeito de recuar (feedback real: "a lupa...
// já começa no finalzinho, fica com pouco recurso pra diminuir"). Piso
// menor que 1 dá essa folga de verdade; teto um pouco menor (3 em vez de
// 4) porque o zoom de entrada (1) já fica mais perto do meio do range.
const ZOOM_MINIMO = 0.5;
const ZOOM_MAXIMO = 3;
const ZOOM_INICIAL = 1;

function lerDimensoes(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function pareceHeic(file) {
  return file.type === 'image/heic' || file.type === 'image/heif' || EXT_HEIC.test(file.name || '');
}

// HEIC (foto de iPhone) não decodifica em <canvas> na maioria dos
// navegadores — precisa de decode explícito antes de qualquer coisa.
// Import dinâmico: só baixa o wasm do heic2any se alguém realmente
// escolher um arquivo HEIC.
async function converterSeHeic(file) {
  if (!pareceHeic(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const resultado = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(resultado) ? resultado[0] : resultado;
  const nomeBase = (file.name || 'imagem').replace(EXT_HEIC, '');
  return new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' });
}

// null = ok pra seguir; string = motivo do bloqueio (formato/tamanho fora
// do aceitável). Aviso de dimensão pequena é separado — não bloqueia.
function validarArquivo(file) {
  const aceitaPorMime = FORMATOS_MIME_ACEITOS.includes(file.type) || pareceHeic(file);
  if (!aceitaPorMime) return 'formato não aceito — envie JPG, PNG, WEBP ou HEIC';
  if (file.size > TAMANHO_MAX_ORIGINAL) return 'arquivo muito grande (máx. 10MB)';
  return null;
}

function criarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}

// Recorta a área escolhida, redimensiona pro lado maior não passar de
// LADO_MAXIMO_SAIDA e comprime em JPEG reduzindo a qualidade em passos até
// caber no teto de tamanho (ou bater o piso de qualidade, pra nunca sair
// com uma imagem ilegível).
async function getRecorteComoBlob(imageSrc, pixelCrop) {
  const imagem = await criarImagem(imageSrc);
  const escala = Math.min(1, LADO_MAXIMO_SAIDA / Math.max(pixelCrop.width, pixelCrop.height));
  const largura = Math.max(1, Math.round(pixelCrop.width * escala));
  const altura = Math.max(1, Math.round(pixelCrop.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imagem, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, largura, altura);

  let qualidade = QUALIDADE_INICIAL;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
  while (blob && blob.size > TAMANHO_ALVO_SAIDA && qualidade > QUALIDADE_MINIMA) {
    qualidade = Math.max(QUALIDADE_MINIMA, qualidade - 0.1);
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
  }
  return blob;
}

/**
 * @param {number} aspectRatio - largura/altura do recorte (1 = quadrado, 16/9 = banner...)
 * @param {boolean} multiple - permite escolher vários arquivos de uma vez; abre o crop um de cada vez, em fila
 * @param {string} label - texto do botão
 * @param {string} hint - texto de ajuda abaixo do botão
 * @param {boolean} disabled
 * @param {string} tamanhoIcone - classes de tamanho do ícone (Camera/Loader2) do botão, ex. "w-12 h-12" pra áreas de upload grandes/destacadas. Default "w-4 h-4" (botão compacto de sempre).
 * @param {(file: File) => void|Promise<void>} onCropComplete - chamado com o File JPEG final a cada imagem confirmada
 */
export default function ImageCropUpload({ aspectRatio = 1, multiple = false, label = 'Selecionar imagem', hint, disabled = false, tamanhoIcone = 'w-4 h-4', onCropComplete, className = '', botaoClassName }) {
  const inputRef = useRef(null);
  const [carregandoSelecao, setCarregandoSelecao] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [itemAtual, setItemAtual] = useState(null); // { src, nomeBase, restantes }
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(ZOOM_INICIAL);
  const [areaPixels, setAreaPixels] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function abrirSeletor() {
    if (disabled || carregandoSelecao || salvando) return;
    inputRef.current?.click();
  }

  function aoArrastarSobre(e) {
    e.preventDefault();
    if (disabled || carregandoSelecao) return;
    setArrastando(true);
  }
  function aoSairArraste() { setArrastando(false); }
  function aoSoltar(e) {
    e.preventDefault();
    setArrastando(false);
    if (disabled || carregandoSelecao) return;
    aoEscolherArquivos(e.dataTransfer.files);
  }

  async function aoEscolherArquivos(fileList) {
    const arquivos = Array.from(fileList || []);
    if (!arquivos.length) return;

    const validos = [];
    for (const file of arquivos) {
      const erro = validarArquivo(file);
      if (erro) toast.error(`"${file.name}": ${erro}`);
      else validos.push(file);
    }
    if (!validos.length) return;
    abrirProximoDaFila(validos);
  }

  async function abrirProximoDaFila(fila) {
    const [proximo, ...resto] = fila;
    if (!proximo) return;

    setCarregandoSelecao(true);
    try {
      const arquivoDecodificavel = await converterSeHeic(proximo);
      const src = URL.createObjectURL(arquivoDecodificavel);
      const dim = await lerDimensoes(src);
      if (dim && (dim.width < DIMENSAO_MINIMA || dim.height < DIMENSAO_MINIMA)) {
        toast(`"${proximo.name}" é só ${dim.width}×${dim.height}px — pode ficar borrada.`, { icon: '⚠️', duration: 5000 });
      }
      if (arquivoDecodificavel.size < TAMANHO_MIN_ORIGINAL) {
        toast(`"${proximo.name}" tem um arquivo bem pequeno — confira a qualidade antes de confirmar.`, { icon: '⚠️', duration: 5000 });
      }
      setCrop({ x: 0, y: 0 });
      setZoom(ZOOM_INICIAL);
      setAreaPixels(null);
      setItemAtual({ src, nomeBase: proximo.name.replace(/\.[^.]+$/, '') || 'imagem', restantes: resto });
    } catch {
      toast.error(`Não consegui abrir "${proximo.name}" — tente outra imagem.`);
      abrirProximoDaFila(resto);
    } finally {
      setCarregandoSelecao(false);
    }
  }

  const aoCompletarCrop = useCallback((_areaPercentual, areaPixelsNovo) => setAreaPixels(areaPixelsNovo), []);

  function fecharItemAtual() {
    const restantes = itemAtual?.restantes || [];
    if (itemAtual) URL.revokeObjectURL(itemAtual.src);
    setItemAtual(null);
    setAreaPixels(null);
    if (restantes.length) abrirProximoDaFila(restantes);
  }

  async function confirmar() {
    if (!itemAtual || !areaPixels || salvando) return;
    setSalvando(true);
    try {
      const blob = await getRecorteComoBlob(itemAtual.src, areaPixels);
      if (!blob) throw new Error('Falha ao gerar imagem recortada');
      const arquivoFinal = new File([blob], `${itemAtual.nomeBase}.jpg`, { type: 'image/jpeg' });
      await onCropComplete?.(arquivoFinal);
      fecharItemAtual();
    } catch {
      toast.error('Erro ao processar a imagem — tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    if (salvando) return;
    fecharItemAtual();
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={abrirSeletor}
        onDragOver={aoArrastarSobre}
        onDragLeave={aoSairArraste}
        onDrop={aoSoltar}
        disabled={disabled || carregandoSelecao}
        className={`${botaoClassName || 'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60'}${arrastando ? ' ring-2 ring-[#7C3AED] ring-offset-1' : ''}`}
      >
        {carregandoSelecao ? <Loader2 className={`${tamanhoIcone} animate-spin`} /> : <Camera className={tamanhoIcone} />}
        {arrastando ? 'Solte a foto aqui' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={(e) => { aoEscolherArquivos(e.target.files); e.target.value = ''; }}
      />
      {hint && <p className="text-slate-400 text-xs mt-1.5">{hint}</p>}

      {itemAtual && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <Cropper
              image={itemAtual.src}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              minZoom={ZOOM_MINIMO}
              maxZoom={ZOOM_MAXIMO}
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={aoCompletarCrop}
            />
            <button
              type="button"
              onClick={cancelar}
              disabled={salvando}
              aria-label="Cancelar"
              className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/50 flex items-center justify-center text-white disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-shrink-0 bg-black px-4 pt-3 space-y-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3">
              <button
                type="button" onClick={() => setZoom(z => Math.max(ZOOM_MINIMO, +(z - 0.2).toFixed(2)))}
                aria-label="Diminuir zoom"
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white flex-shrink-0"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <input
                type="range" min={ZOOM_MINIMO} max={ZOOM_MAXIMO} step={0.01} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-white"
                aria-label="Zoom"
              />
              <button
                type="button" onClick={() => setZoom(z => Math.min(ZOOM_MAXIMO, +(z + 0.2).toFixed(2)))}
                aria-label="Aumentar zoom"
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white flex-shrink-0"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button" onClick={cancelar} disabled={salvando}
                className="flex-1 h-11 rounded-xl bg-white/10 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                type="button" onClick={confirmar} disabled={salvando || !areaPixels}
                className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: ROXO }}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

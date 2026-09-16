import { useEffect, useState } from 'react';
import { Download, MoreVertical, X } from 'lucide-react';
import { DOURADO, DOURADO_ESCURO, ROXO } from '../pages/public/Marketplace/theme';

// Mesma chave do InstallPWABanner — os dois componentes refletem o mesmo
// estado real de "já instalado" (não é dono exclusivo de nenhum dos dois).
const CHAVE_INSTALADO = 'iub_pwa_instalado';

function jaRodandoInstalado() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
// Chrome/Edge/Opera/Samsung Internet suportam beforeinstallprompt — se o
// evento ainda não disparou (heurística de engajamento do browser, ou só
// demorou), orienta o menu manual em vez do texto genérico de "não suporta".
function ehChromiumInstalavel() {
  const ua = navigator.userAgent;
  return /chrome|chromium|crios|edg|opr|samsungbrowser/i.test(ua) && !/firefox|fxios/i.test(ua);
}

const PASSOS_IOS = [
  { icone: '⬆️', texto: 'Toque no ícone de compartilhar do Safari (embaixo da tela)' },
  { icone: '📜', texto: 'Role a lista de opções pra baixo' },
  { icone: '➕', texto: 'Toque em "Adicionar à Tela de Início"' },
  { icone: '✅', texto: 'Confirme tocando em "Adicionar"' },
];

// Botão permanente de "Instalar app" pro header — complementa o
// InstallPWABanner (que só aparece 1x e depende do `beforeinstallprompt`
// disparar sozinho, o que nem sempre acontece). Feedback real: "não
// apareceu nada... e se criássemos um botão instalar tipo ao lado do
// entrar... instalar app".
//
// variant:
// - 'header' (default): ícone sempre visível, texto "Instalar app" some
//   abaixo de `sm` — pra ficar direto numa barra de header apertada.
// - 'compact': só ícone, sempre (botão circular) — pra rails bem apertados.
// - 'full': ícone + texto, sempre — pra menus/dropdowns com espaço sobrando.
export default function InstallAppButton({ variant = 'header', tone = 'dark', className = '' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [instalado, setInstalado] = useState(true); // true até o efeito confirmar que não tá instalado — evita "flash" do botão em quem já instalou
  const [modal, setModal] = useState(null); // null | 'ios' | 'manual' | 'unsupported'

  useEffect(() => {
    if (jaRodandoInstalado() || localStorage.getItem(CHAVE_INSTALADO) === 'true') {
      setInstalado(true);
      return;
    }
    setInstalado(false);

    function aoTerPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function aoInstalar() {
      localStorage.setItem(CHAVE_INSTALADO, 'true');
      setInstalado(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', aoTerPrompt);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoTerPrompt);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  async function clicar() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(CHAVE_INSTALADO, 'true');
        setInstalado(true);
      }
      setDeferredPrompt(null);
      return;
    }
    if (ehIOS()) { setModal('ios'); return; }
    if (ehChromiumInstalavel()) { setModal('manual'); return; }
    setModal('unsupported');
  }

  if (instalado) return null;

  const classesVariant =
    variant === 'compact'
      ? 'w-11 h-11 rounded-full'
      : variant === 'full'
      ? 'px-3.5 py-2 rounded-lg'
      : 'w-11 h-11 sm:w-auto sm:px-3.5 sm:py-2 rounded-full sm:rounded-lg';

  // 'light' = pra cima de fundo escuro/roxo (texto/borda dourado claro,
  // hover translúcido branco); 'dark' = pra cima de fundo branco/claro
  // (texto dourado escuro, mais legível, hover amarelo bem clarinho).
  const classesTone = tone === 'light' ? 'hover:bg-white/10' : 'hover:bg-[#FFF8E1]';
  const corTexto = tone === 'light' ? DOURADO : DOURADO_ESCURO;

  return (
    <>
      <button
        type="button"
        onClick={clicar}
        aria-label="Instalar app"
        title="Instalar app"
        className={`inline-flex items-center justify-center gap-1.5 font-semibold text-sm border transition-colors flex-shrink-0 ${classesVariant} ${classesTone} ${className}`}
        style={{ borderColor: DOURADO, color: corTexto }}
      >
        <Download className="w-4 h-4 flex-shrink-0" />
        {variant !== 'compact' && (
          <span className={variant === 'header' ? 'hidden sm:inline' : ''}>Instalar app</span>
        )}
      </button>

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            {modal === 'ios' && (
              <>
                <h2 className="font-black text-lg pr-8" style={{ color: '#0F0F14' }}>Instalar IUB MAIS+</h2>
                <p className="text-slate-500 text-sm mt-1 mb-5">Adicione o IUB MAIS+ na sua tela inicial pra usar como app.</p>
                <ol className="space-y-3">
                  {PASSOS_IOS.map((passo) => (
                    <li key={passo.texto} className="flex items-center gap-3 text-sm text-slate-700">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">{passo.icone}</span>
                      {passo.texto}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {modal === 'manual' && (
              <>
                <h2 className="font-black text-lg pr-8" style={{ color: '#0F0F14' }}>Instalar IUB MAIS+</h2>
                <p className="text-slate-500 text-sm mt-1 mb-5">Use o menu do seu navegador pra instalar:</p>
                <p className="flex items-center gap-2.5 text-sm text-slate-700 bg-slate-50 rounded-xl p-4">
                  <MoreVertical className="w-4 h-4 flex-shrink-0" /> Menu do navegador → "Instalar app" ou "Adicionar à tela inicial"
                </p>
              </>
            )}

            {modal === 'unsupported' && (
              <>
                <h2 className="font-black text-lg pr-8" style={{ color: '#0F0F14' }}>Instalação não disponível</h2>
                <p className="text-slate-500 text-sm mt-2">
                  Este navegador não suporta instalação automática. Pra instalar o IUB MAIS+ como app, recomendamos abrir esse site no <strong>Chrome</strong> (Android/desktop) ou <strong>Safari</strong> (iPhone).
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setModal(null)}
              className="w-full mt-6 h-11 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: ROXO }}
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

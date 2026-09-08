import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const CHAVE_DISPENSADO = 'iub_pwa_banner_dispensado_em';
const CHAVE_INSTALADO = 'iub_pwa_instalado';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function jaRodandoInstalado() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function ehMobile() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function foiDispensadoRecentemente() {
  const em = Number(localStorage.getItem(CHAVE_DISPENSADO));
  return em && Date.now() - em < COOLDOWN_MS;
}

// Banner discreto de "instalar app" — só no marketplace público (ver
// MarketplaceFallback em App.jsx), só em mobile, nunca se já instalado ou
// dispensado nos últimos 7 dias. Android/Chrome usa o prompt nativo via
// evento `beforeinstallprompt`; iOS Safari não expõe esse evento (Apple não
// suporta), então mostra instrução manual (Compartilhar → Adicionar à Tela
// de Início) em vez de botão de instalar.
export default function InstallPWABanner() {
  const [promptEvento, setPromptEvento] = useState(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!ehMobile() || jaRodandoInstalado() || localStorage.getItem(CHAVE_INSTALADO) === 'true' || foiDispensadoRecentemente()) {
      return;
    }

    if (ehIOS()) {
      setMostrarIOS(true);
      setVisivel(true);
      return;
    }

    function aoTerPrompt(e) {
      e.preventDefault();
      setPromptEvento(e);
      setVisivel(true);
    }
    function aoInstalar() {
      localStorage.setItem(CHAVE_INSTALADO, 'true');
      fechar();
    }

    window.addEventListener('beforeinstallprompt', aoTerPrompt);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoTerPrompt);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  function fechar() {
    setSaindo(true);
    setTimeout(() => setVisivel(false), 300);
  }

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    fechar();
  }

  async function instalar() {
    if (!promptEvento) return;
    promptEvento.prompt();
    const { outcome } = await promptEvento.userChoice;
    if (outcome === 'accepted') localStorage.setItem(CHAVE_INSTALADO, 'true');
    else localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    setPromptEvento(null);
    fechar();
  }

  if (!visivel) return null;

  return (
    <div
      className={`fixed left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-50 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
        saindo ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100 animate-slide-up'
      }`}
      style={{ background: 'linear-gradient(135deg, #3B0A78 0%, #4C1D95 60%, #6D28D9 100%)' }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-white/10 flex items-center justify-center">
          <img src="/icons/icon-96x96.png" alt="" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">📲 Instale o IUB MAIS no seu celular</p>
          <p className="text-white/70 text-xs mt-0.5">Acesso rápido a todos os produtos!</p>

          {mostrarIOS ? (
            <p className="text-white/85 text-xs mt-2 flex items-center gap-1 flex-wrap">
              Toque em <Share className="w-3.5 h-3.5 inline" /> e depois em <strong>"Adicionar à Tela de Início"</strong>
            </p>
          ) : (
            <button
              type="button"
              onClick={instalar}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-transform hover:scale-105"
              style={{ backgroundColor: '#FFB800', color: '#0F0F14' }}
            >
              <Download className="w-3.5 h-3.5" /> Instalar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dispensar}
          aria-label="Fechar"
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <style>{`
        @keyframes iub-slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: iub-slide-up 0.35s ease-out; }
      `}</style>
    </div>
  );
}

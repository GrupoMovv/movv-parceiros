import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MascoteIubMais from '../../components/MascoteIubMais';
import { CONTATO_IUB, MSG_WHATSAPP_SUPORTE, linkWhatsappIub } from '../../config/contato';

// Antes de dizer "404", confere se existe versão nova do site: uma rota
// criada num deploy recente não existe na versão antiga que o navegador
// ainda está rodando. Tendo versão nova, o service worker assume e o
// main.jsx recarrega a página sozinho (controllerchange) — nesse meio
// tempo mostra "Carregando…", nunca o 404. Sem versão nova (ou passou de
// 5s), é 404 de verdade.
function useConferindoAtualizacao() {
  const [conferindo, setConferindo] = useState(() => 'serviceWorker' in navigator);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let vivo = true;
    const desistir = setTimeout(() => { if (vivo) setConferindo(false); }, 5000);
    navigator.serviceWorker.getRegistration()
      .then(async (reg) => {
        if (!reg) return false;
        await reg.update();
        return Boolean(reg.installing || reg.waiting);
      })
      .then((temNova) => { if (vivo && !temNova) setConferindo(false); })
      .catch(() => { if (vivo) setConferindo(false); });
    return () => { vivo = false; clearTimeout(desistir); };
  }, []);
  return conferindo;
}

export default function NotFound() {
  const conferindo = useConferindoAtualizacao();

  if (conferindo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
        <MascoteIubMais tamanho="large" animacao="bounce" />
        <p className="text-base text-iub-cinza mt-6">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
      <MascoteIubMais tamanho="gigante" animacao="bounce" />
      <h1 className="text-6xl font-black text-iub-roxo mt-8">404</h1>
      <p className="text-xl text-iub-cinza mt-2">
        Ops! Essa página se perdeu no marketplace!
      </p>
      <Link to="/marketplace" className="btn-iub-dourado mt-6">
        Voltar pro início
      </Link>
      <p className="text-sm text-iub-cinza mt-6">
        Precisa de ajuda?{' '}
        <a href={linkWhatsappIub(MSG_WHATSAPP_SUPORTE)} target="_blank" rel="noreferrer" className="font-bold text-iub-roxo underline">
          Fale com a gente no WhatsApp {CONTATO_IUB.whatsappExibicao}
        </a>
      </p>
    </div>
  );
}

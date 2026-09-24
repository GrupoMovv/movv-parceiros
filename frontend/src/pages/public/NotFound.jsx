import { Link } from 'react-router-dom';
import MascoteIubMais from '../../components/MascoteIubMais';
import { CONTATO_IUB, MSG_WHATSAPP_SUPORTE, linkWhatsappIub } from '../../config/contato';

export default function NotFound() {
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

import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './theme';

// Bloco 9 (cadastro de parceiro self-service) ainda não existe — por
// enquanto o CTA "Cadastrar minha loja" cai aqui, com um convite direto
// pra falar com a gente por e-mail.
export default function Vender() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-6">
        <Store className="w-8 h-8" style={{ color: ROXO }} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-white">Cadastro de lojas — em breve</h1>
      <p className="text-white/70 text-sm sm:text-base mt-3 max-w-sm">
        Estamos preparando o cadastro automático pra novos parceiros do IUB MAIS. Por enquanto, fale com a gente que a gente já te ajuda a entrar.
      </p>
      <a
        href="mailto:contato@grupomovv.com.br?subject=Quero%20ser%20parceiro%20do%20IUB%20MAIS"
        className="inline-block mt-8 text-sm font-bold px-8 py-4 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
        style={{ backgroundColor: DOURADO, color: PRETO }}
      >
        Falar com a gente
      </a>
      <Link to="/marketplace" className="mt-5 text-white/60 hover:text-white text-xs font-medium underline">
        Voltar pro Marketplace
      </Link>
    </div>
  );
}

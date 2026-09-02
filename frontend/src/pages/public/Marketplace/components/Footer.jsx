import { Link } from 'react-router-dom';
import { ROXO_ESCURO, DOURADO } from '../theme';
import { CATEGORIAS_FILTRO } from '../parceirosData';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: ROXO_ESCURO }} className="text-white mt-10">
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/iub-logo-sm.png" alt="IUB" className="h-9 w-auto rounded-lg" />
            <span className="font-black text-sm">MARKETPLACE</span>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">
            Benefícios exclusivos pra associados SECI. Compre de quem faz parte da nossa comunidade.
          </p>
        </div>

        <div>
          <p className="font-bold text-xs uppercase tracking-wide mb-3 text-white/50">Categorias</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').slice(0, 8).map((c) => (
              <span key={c.label} className="text-white/70 text-xs">{c.label}</span>
            ))}
          </div>
        </div>

        <div>
          <p className="font-bold text-xs uppercase tracking-wide mb-3 text-white/50">Faça parte</p>
          <Link
            to="/cadastrar"
            className="inline-block text-xs font-black px-4 py-2.5 rounded-xl transition-transform hover:scale-105"
            style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
          >
            Quero ser associado
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center">
        <p className="text-white/40 text-[11px]">© {new Date().getFullYear()} IUB Marketplace — SECI. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

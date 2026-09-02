import { Link } from 'react-router-dom';
import { PRETO, ROXO } from '../theme';
import { CATEGORIAS_FILTRO } from '../parceirosData';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: PRETO }} className="text-white mt-24">
      <div className="max-w-5xl mx-auto px-8 lg:px-16 py-16 grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src="/iub-logo-sm.png" alt="IUB" className="h-7 w-auto rounded-lg" />
            <span className="font-bold text-sm">IUB Marketplace</span>
          </div>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Benefícios exclusivos pra associados SECI. Compre de quem faz parte da nossa comunidade.
          </p>
        </div>

        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-4 text-white/40">Categorias</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').slice(0, 8).map((c) => (
              <span key={c.label} className="text-white/60 text-sm">{c.label}</span>
            ))}
          </div>
        </div>

        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-4 text-white/40">Faça parte</p>
          <Link
            to="/cadastrar"
            className="inline-block text-sm font-semibold px-8 py-4 rounded-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg"
            style={{ backgroundColor: ROXO }}
          >
            Quero ser associado
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center">
        <p className="text-white/30 text-xs">© {new Date().getFullYear()} IUB Marketplace — SECI. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

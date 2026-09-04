import { Link } from 'react-router-dom';
import { PRETO } from '../theme';
import { CATEGORIAS_HOME_FOOTER } from '../parceirosData';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: PRETO }} className="text-white mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <img src="/iub-logo-sm.png" alt="IUB" className="h-6 w-auto rounded-lg" />
            <span className="font-bold text-sm">IUB MAIS</span>
          </div>
          <p className="text-white/50 text-xs leading-relaxed max-w-xs">
            Mais qualidade. Mais confiança. Mais vantagens. Benefícios exclusivos pra associados SECI.
          </p>
        </div>

        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-3 text-white/40">Categorias populares</p>
          <div className="flex flex-col gap-1.5">
            {CATEGORIAS_HOME_FOOTER.map((c) => (
              <Link key={c.slug} to={`/marketplace/categoria/${c.slug}`} className="text-white/60 hover:text-white text-sm transition-colors w-fit">
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="font-semibold text-xs uppercase tracking-wide mb-3 text-white/40">Ajuda</p>
          <div className="flex flex-col gap-1.5">
            <Link to="/cadastrar-associado" className="text-white/60 hover:text-white text-sm transition-colors w-fit">Sou associado SECI</Link>
            <Link to="/parceiro/login" className="text-white/60 hover:text-white text-sm transition-colors w-fit">Já sou parceiro — Entrar</Link>
            <Link to="/vender" className="text-white/40 hover:text-white/70 text-xs transition-colors w-fit mt-1">Cadastrar minha empresa</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center">
        <p className="text-white/30 text-xs">IUB MAIS {new Date().getFullYear()} — Marketplace de Itumbiara</p>
      </div>
    </footer>
  );
}

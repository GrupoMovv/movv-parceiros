import { Link } from 'react-router-dom';
import { PRETO, DOURADO } from '../theme';

export default function SponsoredPartners({ parceiros }) {
  return (
    <section className="max-w-7xl mx-auto px-8 lg:px-16 py-16">
      <h2 className="text-3xl md:text-4xl font-extrabold mb-12" style={{ color: PRETO }}>
        Parceiros em destaque
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {parceiros.map((p) => (
          <Link
            key={p.slug}
            to={`/marketplace/parceiro/${p.slug}`}
            className="group relative aspect-[4/5] rounded-3xl overflow-hidden shadow-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-2xl"
            style={{ background: `linear-gradient(160deg, ${p.corIcone} 0%, ${p.corIcone}CC 100%)` }}
          >
            <span className="absolute inset-0 flex items-center justify-center text-8xl opacity-25">{p.icone}</span>
            <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)' }} />

            <span
              className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
              style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
            >
              Patrocinado
            </span>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <p className="text-white text-2xl font-bold leading-tight">{p.nome}</p>
              <p className="text-slate-200 text-sm mt-1 line-clamp-2">{p.descricao}</p>
              <span className="inline-block text-white text-sm font-semibold underline mt-3">Ver ofertas →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

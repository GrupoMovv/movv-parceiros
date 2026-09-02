export default function PartnerMarquee({ parceiros }) {
  const dobrado = [...parceiros, ...parceiros];

  return (
    <section className="bg-white py-16 overflow-hidden">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400 mb-10">
        Marcas que confiam na IUB
      </p>

      <div className="relative">
        <div className="marquee-track flex items-center w-max gap-16">
          {dobrado.map((p, i) => (
            <span
              key={`${p.slug}-${i}`}
              className="flex-shrink-0 flex items-center gap-2 h-[60px] text-2xl font-bold text-slate-300 transition-colors duration-300"
              onMouseEnter={(e) => { e.currentTarget.style.color = p.corIcone; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
            >
              <span className="text-3xl grayscale hover:grayscale-0 transition-all duration-300">{p.icone}</span>
              {p.nome}
            </span>
          ))}
        </div>
        {/* fade nas bordas */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent" />
      </div>
    </section>
  );
}

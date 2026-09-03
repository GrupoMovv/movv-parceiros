import { DOURADO } from '../theme';

function scrollParaParceiros(e) {
  e.preventDefault();
  document.querySelector('#parceiros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function HeroPremium({ nomeAssociado }) {
  return (
    <section
      className="relative min-h-[calc(100vh-70px)] flex items-center justify-center overflow-hidden px-8"
      style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #5B21B6 55%, #7C3AED 100%)' }}
    >
      {/* pattern sutil — circulos concentricos */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" preserveAspectRatio="xMidYMid slice">
        <circle cx="15%" cy="20%" r="220" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="15%" cy="20%" r="340" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="15%" cy="20%" r="460" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="90%" cy="85%" r="200" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="90%" cy="85%" r="320" fill="none" stroke="white" strokeWidth="1" />
      </svg>

      <div className="relative max-w-5xl mx-auto text-center">
        {nomeAssociado && (
          <p
            className="text-sm sm:text-base font-bold uppercase tracking-wide mb-4 animate-fade-up"
            style={{ color: DOURADO }}
          >
            Olá, {nomeAssociado}! 👋
          </p>
        )}
        <h1
          className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-tight tracking-tight animate-fade-up"
        >
          Descubra os melhores parceiros de Itumbiara
        </h1>
        <p
          className="text-lg sm:text-xl font-normal mt-6 max-w-2xl mx-auto animate-fade-up"
          style={{ color: '#D1D5DB', animationDelay: '200ms' }}
        >
          Serviços, comércio e experiências em um só lugar.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fade-up" style={{ animationDelay: '400ms' }}>
          <a
            href="#parceiros"
            onClick={scrollParaParceiros}
            className="w-full sm:w-auto text-center font-semibold text-base px-8 py-4 rounded-xl shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Explorar Ofertas
          </a>
          <a
            href="mailto:contato@grupomovv.com.br?subject=Quero%20ser%20parceiro%20do%20IUB%20MAIS"
            className="w-full sm:w-auto text-center font-semibold text-base px-8 py-4 rounded-xl border-2 border-white text-white transition-all duration-300 ease-out hover:bg-white/10"
          >
            Cadastrar minha empresa
          </a>
        </div>
      </div>
    </section>
  );
}

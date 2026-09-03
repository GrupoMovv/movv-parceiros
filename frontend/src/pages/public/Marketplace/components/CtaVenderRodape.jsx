import { Link } from 'react-router-dom';
import { ROXO_ESCURO, DOURADO } from '../theme';

export default function CtaVenderRodape({ qtdAssociados }) {
  return (
    <section className="mt-24" style={{ backgroundColor: ROXO_ESCURO }}>
      <div className="max-w-3xl mx-auto px-8 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Sua loja também pode estar aqui</h2>
        <p className="text-white/70 text-base mt-3 max-w-lg mx-auto">
          Cadastre gratuitamente e alcance{qtdAssociados ? ` +${qtdAssociados}` : ''} pessoas em Itumbiara.
        </p>
        <Link
          to="/vender"
          className="inline-block mt-8 text-base font-bold px-10 py-4 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Cadastrar minha loja
        </Link>
      </div>
    </section>
  );
}

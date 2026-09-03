import { Link } from 'react-router-dom';
import { ROXO_ESCURO, DOURADO } from '../theme';

export default function CtaVenderRodape() {
  return (
    <section className="mt-24" style={{ backgroundColor: ROXO_ESCURO }}>
      <div className="max-w-3xl mx-auto px-8 py-16 text-center">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide px-4 py-1.5 rounded-full"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          🆓 Cadastro gratuito
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-4">Sua loja também pode estar aqui</h2>
        <p className="text-white/70 text-base mt-3 max-w-lg mx-auto">
          Fortalecer o comércio de Itumbiara nunca foi tão fácil.
        </p>
        <Link
          to="/vender"
          className="inline-block mt-8 text-base font-bold px-10 py-4 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Cadastrar minha loja
        </Link>
        <p className="text-white/50 text-sm mt-4">
          Já tem cadastro?{' '}
          <Link to="/parceiro/login" className="text-white/70 hover:text-white underline">Fazer login como parceiro</Link>
        </p>
      </div>
    </section>
  );
}

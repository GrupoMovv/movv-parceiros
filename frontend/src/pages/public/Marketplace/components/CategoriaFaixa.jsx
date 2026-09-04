import { Link } from 'react-router-dom';
import {
  SquaresFour, ShoppingBag, Wrench, ForkKnife, TShirt, House, Car, Laptop, Sparkle, Gift,
  GraduationCap, Barbell, Pill, Bed, Brain,
} from '@phosphor-icons/react';
import { CATEGORIAS_FILTRO, normalizarCategoria } from '../parceirosData';
import { PRETO, ROXO } from '../theme';

const ICONES = {
  Todas: SquaresFour, Produtos: ShoppingBag, Serviços: Wrench, Alimentação: ForkKnife,
  Moda: TShirt, Casa: House, Automotivo: Car, Tecnologia: Laptop, Beleza: Sparkle,
  Presentes: Gift, Educação: GraduationCap, Esportes: Barbell, Saúde: Pill,
  Hotelaria: Bed, 'Bem-estar': Brain,
};

// Só as categorias que já têm página de produtos de verdade no backend
// (marketplaceHomeController.CATEGORIAS_HOME) viram link — as outras
// (Produtos, Automotivo, Presentes, Educação, Esportes, Hotelaria,
// Bem-estar) ainda só existem como filtro da grade de parceiros aqui
// embaixo ("Compre de empresas de Itumbiara"), não como página própria.
const SLUG_POR_LABEL = {
  Serviços: 'servicos', Alimentação: 'alimentacao', Moda: 'moda', Casa: 'casa',
  Tecnologia: 'tecnologia', Beleza: 'beleza', Saúde: 'saude',
};

// Faixa única de categorias — TODAS as 15, sem duplicar em outro lugar da
// página. Scroll horizontal livre (sem setas), espaçamento generoso entre
// os chips. Quem tem página de produtos própria navega pra lá; o resto
// filtra a grade de parceiros mais abaixo.
export default function CategoriaFaixa({ categoriaAtiva, onSelecionar }) {
  return (
    <section id="categorias" className="scroll-mt-16 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-2.5">
        {CATEGORIAS_FILTRO.map(c => {
          const Icone = ICONES[c.label] || SquaresFour;
          const slug = SLUG_POR_LABEL[c.label];
          const ativa = normalizarCategoria(categoriaAtiva) === normalizarCategoria(c.label);
          const conteudo = (
            <>
              <Icone size={22} weight="duotone" style={{ color: ativa ? ROXO : PRETO }} />
              <span className="text-[11px] font-medium text-center leading-tight whitespace-nowrap" style={{ color: ativa ? ROXO : '#475569' }}>
                {c.label}
              </span>
            </>
          );
          const className = 'flex flex-col items-center gap-1 flex-shrink-0 py-1.5 px-1 rounded-lg hover:bg-slate-50 transition-colors';

          return slug ? (
            <Link key={c.label} to={`/marketplace/categoria/${slug}`} className={className}>{conteudo}</Link>
          ) : (
            <button key={c.label} type="button" onClick={() => onSelecionar(c.label)} className={className}>{conteudo}</button>
          );
        })}
      </div>
    </section>
  );
}

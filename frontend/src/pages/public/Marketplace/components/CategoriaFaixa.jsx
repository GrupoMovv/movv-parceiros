import { Link } from 'react-router-dom';
import {
  ShoppingBag, Wrench, ForkKnife, TShirt, House, Car, Laptop, Sparkle, Gift,
  GraduationCap, Barbell, Pill, Bed, Brain, Wine, PawPrint,
} from '@phosphor-icons/react';
import { CATEGORIAS_FILTRO, normalizarCategoria } from '../parceirosData';
import { ROXO } from '../theme';

const ICONES = {
  Produtos: ShoppingBag, Serviços: Wrench, Alimentação: ForkKnife, Moda: TShirt, Casa: House,
  Automotivo: Car, Tecnologia: Laptop, Beleza: Sparkle, Presentes: Gift, Educação: GraduationCap,
  Esportes: Barbell, Fitness: Barbell, Saúde: Pill, Hospedagem: Bed, 'Bem-estar': Brain, Bebidas: Wine, Pet: PawPrint,
};

// Só as categorias que já têm página de produtos de verdade no backend
// (marketplaceHomeController.CATEGORIAS_HOME) viram link — as outras
// (Automotivo, Presentes, Educação, Esportes, Hospedagem, Bem-estar) ainda
// só existem como filtro da grade de parceiros aqui embaixo ("Compre de
// empresas de Itumbiara"), não como página própria. Alimentação não está
// mais em CATEGORIAS_HOME (virou área própria, IUB Food) — rota especial
// abaixo em vez de entrar nesse mapa de slug genérico. Bebidas idem (IUB
// BEER, área +18 própria).
const SLUG_POR_LABEL = {
  Serviços: 'servicos', Moda: 'moda', Casa: 'casa',
  Tecnologia: 'tecnologia', Beleza: 'beleza', Saúde: 'saude', Fitness: 'fitness',
};
const ROTA_ESPECIAL_POR_LABEL = {
  Alimentação: '/marketplace/food',
  Bebidas: '/beer',
  // Pet: página própria com filtros de serviço, porte, bairro, raça e preço.
  Pet: '/marketplace/pet',
};

// Faixa única de categorias — TODAS as 15 (sem "Todas"), sem duplicar em
// outro lugar da página. Ícone Phosphor em círculo pastel roxo + nome
// embaixo, scroll horizontal livre (sem setas). Quem tem página de
// produtos própria navega pra lá; o resto filtra a grade de parceiros
// mais abaixo. Só o conteúdo — o container (fundo branco, posição sobre o
// banner, id="categorias" pro link do menu) é responsabilidade de quem usa
// (ver Marketplace.jsx).
export default function CategoriaFaixa({ categoriaAtiva, onSelecionar }) {
  return (
    <div className="flex items-start gap-3 sm:gap-5 overflow-x-auto scrollbar-none px-4 sm:px-0 py-4 sm:py-0">
      {CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => {
        const Icone = ICONES[c.label] || ShoppingBag;
        const slug = SLUG_POR_LABEL[c.label];
        const rotaEspecial = ROTA_ESPECIAL_POR_LABEL[c.label];
        const ativa = normalizarCategoria(categoriaAtiva) === normalizarCategoria(c.label);
        const conteudo = (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ backgroundColor: ativa ? ROXO : '#F5F0FC' }}
            >
              <Icone size={26} weight="duotone" color={ativa ? '#fff' : ROXO} />
            </div>
            <span className="text-[11px] font-medium text-center leading-tight whitespace-nowrap" style={{ color: ativa ? ROXO : '#475569' }}>
              {c.label}
            </span>
          </>
        );
        const className = 'flex flex-col items-center gap-1.5 flex-shrink-0 w-[76px]';

        if (rotaEspecial) return <Link key={c.label} to={rotaEspecial} className={className}>{conteudo}</Link>;
        return slug ? (
          <Link key={c.label} to={`/marketplace/categoria/${slug}`} className={className}>{conteudo}</Link>
        ) : (
          <button key={c.label} type="button" onClick={() => onSelecionar(c.label)} className={className}>{conteudo}</button>
        );
      })}
    </div>
  );
}

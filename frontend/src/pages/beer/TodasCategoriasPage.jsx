import { useOutletContext } from 'react-router-dom';
import TodasCategorias from '../../components/beer/TodasCategorias';
import { CabecalhoBeer } from './BeerLayout';
import { BEER } from './beerConfig';

// /beer/categorias — catálogo completo numa tela só dele. É pra onde o
// botão "Ver todas as categorias" da home leva no celular (lá a home só
// mostra os Mais acessados).
export default function TodasCategoriasPage() {
  const { categorias } = useOutletContext();
  return (
    <>
      <CabecalhoBeer titulo="Todas as categorias" subtitulo="Bebidas, petiscos, comida pronta, churrasco e festa" />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8">
        {categorias == null
          ? <div className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />
          : <TodasCategorias grupos={categorias} />}
      </main>
    </>
  );
}

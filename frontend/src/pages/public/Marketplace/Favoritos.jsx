import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import SecaoProdutosFavoritos from './components/SecaoProdutosFavoritos';
import SecaoParceiros from './components/SecaoParceiros';
import { useFavoritos, CHAVE_FAVORITOS_PRODUTOS } from './useFavoritos';
import { useProdutosPorIds } from './useSecaoData';
import { useAssociadoSessao } from './useAssociadoSessao';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';

// Página dedicada de favoritos (produtos + lojas) — existia só como um
// toggle que trocava o conteúdo de uma seção lá embaixo da home
// (Marketplace.jsx, id="parceiros"), fora da tela em quem não rolasse até
// lá. Clicar no coração do header (com badge) não levava a lugar nenhum
// visível — parecia que "só marcava/desmarcava" (feedback real de teste).
// Rota própria resolve os dois problemas de uma vez: navegação de
// verdade (funciona a partir de qualquer página) e o conteúdo aparece
// no topo, sem precisar adivinhar que precisa rolar.
export default function Favoritos() {
  const navigate = useNavigate();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

  const { favoritos: favoritosParceiros, alternar: alternarFavoritoParceiro, ehFavorito } = useFavoritos();
  const { favoritos: favoritosProdutosIds } = useFavoritos(CHAVE_FAVORITOS_PRODUTOS);
  const { produtos: produtosFavoritos, carregando: carregandoProdutos } = useProdutosPorIds(favoritosProdutosIds);

  // Lojas favoritas vêm do banco (a lista escrita no código, com os
  // convênios do SECI, saiu em 09/10). Loja pausada ou que não existe mais
  // responde 404 e simplesmente não aparece.
  const [parceirosFavoritos, setParceirosFavoritos] = useState([]);
  const chaveFavoritos = favoritosParceiros.join('|');
  useEffect(() => {
    let vivo = true;
    const slugs = chaveFavoritos ? chaveFavoritos.split('|') : [];
    Promise.all(slugs.map(slug => api.get(`/public/lojas/${encodeURIComponent(slug)}`).then(r => r.data).catch(() => null)))
      .then(lojas => { if (vivo) setParceirosFavoritos(lojas.filter(Boolean)); });
    return () => { vivo = false; };
  }, [chaveFavoritos]);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={() => navigate('/marketplace')}
      />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full pt-2">
          <BotaoVoltar fallback="/marketplace" />
        </div>

      <div className="px-6 py-10 sm:py-14 text-center" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 60%, #B87E00 150%)' }}>
        <h1 className="text-white font-black text-2xl sm:text-4xl">❤️ MEUS FAVORITOS</h1>
        <p className="text-white/85 text-sm sm:text-lg mt-2">Produtos e lojas que você salvou</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-8 w-full flex-1 space-y-8">
        <SecaoProdutosFavoritos produtos={produtosFavoritos} carregando={carregandoProdutos} />
        <SecaoParceiros
          titulo="Lojas favoritas"
          parceiros={parceirosFavoritos}
          ehFavorito={ehFavorito}
          onToggleFavorito={alternarFavoritoParceiro}
          vazio="Você ainda não favoritou nenhuma loja."
        />
      </div>

      <Footer />

      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

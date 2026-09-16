import Reveal from './Reveal';
import PartnerCard from './PartnerCard';
import MascoteIubMais from '../../../../components/MascoteIubMais';
import { PRETO } from '../theme';

// Grade de parceiros (loja) com título + estado vazio — usada tanto na
// home (grade "Compre de empresas de Itumbiara"/categoria filtrada)
// quanto em /favoritos ("Lojas favoritas"). Extraída de Marketplace.jsx
// pra não duplicar entre as duas telas.
export default function SecaoParceiros({ titulo, parceiros, ehFavorito, onToggleFavorito, vazio }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
        📍 {titulo}
      </h2>
      {parceiros.length === 0 ? (
        <div className="text-center py-16">
          <MascoteIubMais tamanho="large" animacao="float" className="mx-auto" />
          <p className="text-iub-roxo font-bold text-lg mt-4">{vazio}</p>
          <p className="text-iub-cinza mt-2">Mas continua procurando, tem muita coisa boa aqui!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {parceiros.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 10) * 40}>
              <PartnerCard
                parceiro={p}
                favorito={ehFavorito(p.slug)}
                onToggleFavorito={onToggleFavorito}
              />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

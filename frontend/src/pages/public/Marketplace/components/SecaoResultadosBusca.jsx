import Reveal from './Reveal';
import CardProdutoGrande from './CardProdutoGrande';
import PartnerCardBusca from './PartnerCardBusca';
import MascoteIubMais from '../../../../components/MascoteIubMais';
import { PRETO } from '../theme';

// Resultado de busca de verdade (ver getBusca no backend + useBusca no
// front) — produtos e parceiros (loja/serviço/IUB Food, todos a mesma
// tabela sindicato_parceiros) que baterem o termo digitado. Antes a
// busca só filtrava, no cliente, os ~11 parceiros estáticos de
// parceirosData.js — nunca o catálogo real, então digitar qualquer coisa
// sempre devolvia a mesma grade "Compre de empresas de Itumbiara"
// intacta (bug real reportado).
export default function SecaoResultadosBusca({ termo, produtos, parceiros, carregando }) {
  if (carregando) {
    return (
      <section>
        <h2 className="text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
          Buscando por "{termo}"...
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[220px] rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      </section>
    );
  }

  const semResultado = produtos.length === 0 && parceiros.length === 0;

  if (semResultado) {
    return (
      <section>
        <h2 className="text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
          Resultado da busca por "{termo}"
        </h2>
        <div className="text-center py-16">
          <MascoteIubMais tamanho="large" animacao="float" className="mx-auto" />
          <p className="text-iub-roxo font-bold text-lg mt-4">Nada encontrado pra "{termo}".</p>
          <p className="text-iub-cinza mt-2">Tenta outro termo, ou dá uma olhada nas categorias aqui em cima.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {produtos.length > 0 && (
        <section>
          <h2 className="text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
            📦 Produtos pra "{termo}" ({produtos.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {produtos.map((p, i) => (
              <Reveal key={p.id} delay={(i % 10) * 40}>
                <CardProdutoGrande produto={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {parceiros.length > 0 && (
        <section>
          <h2 className="text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
            📍 Lojas e prestadores pra "{termo}" ({parceiros.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {parceiros.map((p, i) => (
              <Reveal key={p.id} delay={(i % 10) * 40}>
                <PartnerCardBusca parceiro={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

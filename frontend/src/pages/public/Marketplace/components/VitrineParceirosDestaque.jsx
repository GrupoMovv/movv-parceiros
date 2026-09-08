import { Star } from '@phosphor-icons/react';
import CardParceiroDestaque from './CardParceiroDestaque';
import { useParceirosDestaques } from '../useSecaoData';
import { PRETO, ROXO } from '../theme';

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square rounded-2xl bg-slate-100" />
      <div className="h-3 bg-slate-100 rounded-full mt-3 w-2/3" />
      <div className="h-2.5 bg-slate-100 rounded-full mt-2 w-1/3" />
    </div>
  );
}

// Vitrine só de parceiros Premium/Master (+ seed de demonstração) — fica
// logo após a faixa de categorias, antes das vitrines de produto. Some
// sozinha se não tiver nenhum parceiro elegível (ninguém ainda em plano
// pago fora do seed).
export default function VitrineParceirosDestaque() {
  const { parceiros, carregando } = useParceirosDestaques();

  if (!carregando && parceiros.length === 0) return null;

  return (
    <section>
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight" style={{ color: PRETO }}>
          <Star size={26} weight="duotone" color={ROXO} /> Parceiros em Destaque
        </h2>
        <p className="text-sm text-slate-400 mt-1">As melhores empresas de Itumbiara</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {carregando
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : parceiros.map(p => <CardParceiroDestaque key={p.id} parceiro={p} />)}
      </div>
    </section>
  );
}

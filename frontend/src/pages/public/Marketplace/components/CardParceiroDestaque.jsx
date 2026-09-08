import { Link } from 'react-router-dom';
import { PRETO } from '../theme';
import IconePorCategoria from './IconePorCategoria';
import SeloPlano from './SeloPlano';

// Card "grande" só pra vitrine Parceiros em Destaque (Premium/Master) —
// mesma base do PartnerCard normal, mas com foto maior e selo do plano em
// destaque por cima da imagem em vez de discreto embaixo do nome.
export default function CardParceiroDestaque({ parceiro }) {
  return (
    <Link
      to={`/marketplace/parceiro/${parceiro.slug}`}
      className="group flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1 overflow-hidden border border-slate-100"
    >
      <div className="relative w-full aspect-square flex items-center justify-center bg-purple-50">
        {parceiro.logo_url ? (
          <img src={parceiro.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <IconePorCategoria
            nome={parceiro.nome} categoria={parceiro.categoria_principal} categorias={parceiro.categorias}
            size={52} weight="duotone" color="#4C1D95"
          />
        )}
        <div className="absolute top-2.5 left-2.5">
          <SeloPlano plano={parceiro.plano} size="lg" />
        </div>
      </div>

      <div className="p-3.5">
        <h3 className="font-bold text-sm leading-tight truncate" style={{ color: PRETO }}>{parceiro.nome}</h3>
        <p className="text-slate-500 text-xs mt-1 truncate">{parceiro.categoria_principal || parceiro.categorias?.[0]}</p>
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { PRETO } from '../theme';
import IconePorCategoria from './IconePorCategoria';
import SeloPlano from './SeloPlano';
import SeloPioneiro from './SeloPioneiro';

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
        {/* Selos no canto de cima, o Pioneiro embaixo do plano: lado a lado
            eles se sobrepunham (o card tem ~165 px no celular e ~175 px no
            computador). No celular os selos são menores — o "lg" saía cortado
            na borda ("MASTER VI"). */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1 sm:hidden">
          <SeloPlano plano={parceiro.plano} size="sm" />
          {parceiro.e_pioneiro && <SeloPioneiro pioneiro size="sm" />}
        </div>
        <div className="absolute top-2.5 left-2.5 hidden sm:flex flex-col items-start gap-1.5">
          <SeloPlano plano={parceiro.plano} size="lg" />
          {parceiro.e_pioneiro && <SeloPioneiro pioneiro size="lg" />}
        </div>
      </div>

      <div className="p-3.5">
        <h3 className="font-bold text-sm leading-tight truncate" style={{ color: PRETO }}>{parceiro.nome}</h3>
        <p className="text-slate-500 text-xs mt-1 truncate">{parceiro.categoria_principal || parceiro.categorias?.[0]}</p>
      </div>
    </Link>
  );
}

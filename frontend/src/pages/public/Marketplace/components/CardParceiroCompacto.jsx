import { Link } from 'react-router-dom';
import { PRETO, ROXO } from '../theme';
import IconePorCategoria from './IconePorCategoria';
import SeloPlano from './SeloPlano';
import SeloPioneiro from './SeloPioneiro';

export default function CardParceiroCompacto({ parceiro }) {
  const categoria = parceiro.categoria_principal || parceiro.categorias?.[0];

  const temSelo = (parceiro.plano && parceiro.plano !== 'gratis') || parceiro.e_pioneiro;

  // Celular (2 cards por linha, ~160 px cada): logo e nome em cima, selo
  // numa linha própria e "Ver perfil" embaixo — antes o selo, que não
  // quebra linha, passava por cima do "Ver perfil". A partir de sm
  // (640 px) é o layout de sempre: tudo numa linha, "Ver perfil" à direita.
  return (
    <Link
      to={`/marketplace/parceiro/${parceiro.slug}`}
      className="group flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-3 sm:p-4"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 sm:flex-1">
        {parceiro.logo_url ? (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 overflow-hidden bg-white border border-slate-100">
            <img src={parceiro.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50">
            <IconePorCategoria
              nome={parceiro.nome} categoria={parceiro.categoria_principal} categorias={parceiro.categorias}
              size={26} weight="duotone" color={ROXO}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{parceiro.nome}</p>
            <span className="hidden sm:contents">
              <SeloPlano plano={parceiro.plano} size="sm" />
              <SeloPioneiro pioneiro={parceiro.e_pioneiro} size="sm" />
            </span>
          </div>
          {categoria && <p className="text-slate-400 text-xs truncate mt-0.5">{categoria}</p>}
        </div>
      </div>

      {temSelo && (
        <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
          <SeloPlano plano={parceiro.plano} size="sm" />
          <SeloPioneiro pioneiro={parceiro.e_pioneiro} size="sm" />
        </div>
      )}

      <span className="flex-shrink-0 text-xs font-semibold group-hover:underline" style={{ color: ROXO }}>
        Ver perfil
      </span>
    </Link>
  );
}

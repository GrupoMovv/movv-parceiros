import { Link } from 'react-router-dom';
import { PRETO, ROXO } from '../theme';
import IconePorCategoria from './IconePorCategoria';

export default function CardParceiroCompacto({ parceiro }) {
  const categoria = parceiro.categoria_principal || parceiro.categorias?.[0];

  return (
    <Link
      to={`/marketplace/parceiro/${parceiro.slug}`}
      className="group flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-4"
    >
      {parceiro.logo_url ? (
        <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-white border border-slate-100">
          <img src={parceiro.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50">
          <IconePorCategoria
            nome={parceiro.nome} categoria={parceiro.categoria_principal} categorias={parceiro.categorias}
            size={26} weight="duotone" color={ROXO}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{parceiro.nome}</p>
        {categoria && <p className="text-slate-400 text-xs truncate mt-0.5">{categoria}</p>}
      </div>

      <span className="flex-shrink-0 text-xs font-semibold group-hover:underline" style={{ color: ROXO }}>
        Ver perfil
      </span>
    </Link>
  );
}

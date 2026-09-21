import { Link } from 'react-router-dom';
import { ImageOff, Clock } from 'lucide-react';
import SeloPlano from './SeloPlano';
import { ROXO, PRETO } from '../theme';
import { statusFuncionamento, textoTaxaEntrega, textoTempoPreparo } from '../../../../utils/iubFood';

// Card de restaurante (não item de cardápio) — mesmo raciocínio do
// CardServico: um card = um parceiro. Aberto/fechado, delivery e tempo vêm
// da tela Entrega do painel (migration 051); quem ainda não configurou
// cai no `duracao_media` antigo (texto livre, migration 049) pro tempo e
// fica sem badge de aberto/fechado — não dá pra afirmar nenhum dos dois.
export default function CardFood({ restaurante }) {
  const tipo = restaurante.categoria_principal || restaurante.categorias?.[0] || null;
  const status = statusFuncionamento(restaurante.horario_funcionamento);
  const tempo = textoTempoPreparo(restaurante);

  return (
    <Link
      to={`/food/${restaurante.slug}`}
      className="group flex flex-col bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out"
    >
      <div className="relative w-full h-[120px] sm:h-[150px] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
        {restaurante.logo_url ? (
          <img src={restaurante.logo_url} alt={restaurante.nome} loading="lazy" className={`w-full h-full object-cover ${status && !status.aberto ? 'grayscale-[60%]' : ''}`} />
        ) : (
          <ImageOff className="w-7 h-7 text-slate-200" />
        )}
        <SeloPlano plano={restaurante.plano} size="sm" className="absolute top-1.5 left-1.5 shadow" />
        {status && (
          <span
            className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
            style={{ backgroundColor: status.aberto ? '#DCFCE7' : '#FEE2E2', color: status.aberto ? '#166534' : '#991B1B' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.aberto ? '#16A34A' : '#DC2626' }} />
            {status.aberto ? 'Aberto' : 'Fechado'}
          </span>
        )}
      </div>

      <div className="pt-2.5 flex-1 flex flex-col">
        {tipo && (
          <p className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: ROXO }}>{tipo}</p>
        )}
        <p className="text-sm font-bold leading-snug line-clamp-2 min-h-[2.4em] mt-0.5" style={{ color: PRETO }}>
          {restaurante.nome}
        </p>

        <div className="mt-1.5 min-h-[2em] space-y-0.5">
          {restaurante.preco_medio && <p className="text-sm font-black" style={{ color: ROXO }}>{restaurante.preco_medio}</p>}
          {tempo && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {tempo}</p>
          )}
          {restaurante.delivery_disponivel && (
            <p className="text-[11px] text-slate-500 truncate">🚚 {textoTaxaEntrega(restaurante)}</p>
          )}
          {status && !status.aberto && (
            <p className="text-[11px] text-slate-400 truncate">Abre {status.proximaAbertura}</p>
          )}
        </div>

        <span
          className="mt-2 flex items-center justify-center text-[11px] font-bold py-1.5 rounded-lg border transition-colors group-hover:bg-purple-50"
          style={{ borderColor: ROXO, color: ROXO }}
        >
          Ver cardápio
        </span>
      </div>
    </Link>
  );
}

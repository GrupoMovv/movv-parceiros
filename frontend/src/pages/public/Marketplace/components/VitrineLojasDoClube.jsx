import { Link } from 'react-router-dom';
import { Diamond, Truck } from '@phosphor-icons/react';
import IconePorCategoria from './IconePorCategoria';
import { useLojasDoClube } from '../useSecaoData';
import { PRETO, ROXO, ROXO_ESCURO, DOURADO } from '../theme';

const pctBR = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// O benefício em destaque no card: o percentual grande e, embaixo, o que
// vem junto (só produtos escolhidos, entrega grátis).
function Beneficio({ clube }) {
  if (clube.percentual == null) {
    return (
      <p className="flex items-center gap-1.5 text-base font-black leading-tight" style={{ color: ROXO_ESCURO }}>
        <Truck size={18} weight="duotone" color={ROXO} /> Entrega grátis
      </p>
    );
  }
  const escolhidos = clube.alcance === 'escolhidos';
  return (
    <>
      <p className="text-2xl font-black leading-none" style={{ color: ROXO_ESCURO, fontFamily: 'Poppins, sans-serif' }}>
        {escolhidos && <span className="text-xs font-bold align-middle mr-1">até</span>}{pctBR(clube.percentual)}%
        <span className="text-xs font-bold ml-1 align-middle">de desconto</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
        {escolhidos ? 'em produtos escolhidos' : 'na loja toda'}{clube.entrega_gratis ? ' + entrega grátis' : ''}
      </p>
    </>
  );
}

function CardLojaClube({ loja }) {
  return (
    <Link
      to={`/marketplace/parceiro/${loja.slug}`}
      className="group flex flex-col gap-2.5 rounded-2xl border bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: `${DOURADO}66` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {loja.logo_url ? (
          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-white border border-slate-100">
            <img src={loja.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50">
            <IconePorCategoria nome={loja.nome} categoria={loja.categoria_principal} categorias={loja.categorias} size={22} weight="duotone" color={ROXO} />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{loja.nome}</p>
          {(loja.categoria_principal || loja.categorias?.[0]) && <p className="text-[11px] text-slate-400 truncate">{loja.categoria_principal || loja.categorias[0]}</p>}
        </div>
      </div>
      <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: `${DOURADO}1F` }}>
        <Beneficio clube={loja.clube} />
      </div>
    </Link>
  );
}

// Vitrine "Lojas do Clube" (b4): home e /clube. Some sozinha sem nenhuma
// loja no Clube. `limite` corta na home; no /clube mostra todas.
export default function VitrineLojasDoClube({ limite = null, titulo = 'Lojas do Clube', subtitulo = 'Desconto todo dia para quem é do Clube MAIS+', id }) {
  const { lojas, carregando } = useLojasDoClube();
  if (!carregando && lojas.length === 0) return null;
  const visiveis = limite ? lojas.slice(0, limite) : lojas;

  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-black tracking-tight" style={{ color: PRETO }}>
            <Diamond size={24} weight="duotone" color={DOURADO} /> {titulo}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{subtitulo}</p>
        </div>
        {limite && lojas.length > limite && (
          <Link to="/clube#lojas" className="text-sm font-semibold whitespace-nowrap hover:underline" style={{ color: ROXO }}>Ver todas</Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {carregando
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[124px] rounded-2xl bg-slate-100 animate-pulse" />)
          : visiveis.map(l => <CardLojaClube key={l.id} loja={l} />)}
      </div>
    </section>
  );
}

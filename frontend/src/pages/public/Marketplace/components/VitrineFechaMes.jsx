import { useEffect, useState } from 'react';
import { Fire } from '@phosphor-icons/react';
import api from '../../../../services/api';
import VitrinePaginada from './VitrinePaginada';
import CardProdutoFechaMes from './CardProdutoFechaMes';

const VERMELHO = '#DC2626';

// Vitrine especial do dia do Fecha Mês — só existe (busca dados) quando o
// evento está ativo hoje; nos outros 29 dias do mês nem faz a chamada.
// Fica sempre ANTES de todas as outras vitrines da home (Marketplace.jsx).
export default function VitrineFechaMes({ ativoHoje }) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!ativoHoje) { setCarregando(false); return; }
    api.get('/public/fecha-mes/produtos')
      .then(res => setProdutos(res.data.produtos || []))
      .catch(() => setProdutos([]))
      .finally(() => setCarregando(false));
  }, [ativoHoje]);

  if (!ativoHoje || (!carregando && produtos.length === 0)) return null;

  return (
    <section
      className="rounded-3xl p-5 sm:p-6"
      style={{ background: `linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(255,184,0,0.10) 100%)`, border: `1px solid rgba(255,184,0,0.35)` }}
    >
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-black tracking-tight" style={{ color: VERMELHO }}>
          <Fire size={28} weight="fill" color={VERMELHO} /> OFERTAS FECHA MÊS
        </h2>
        <p className="text-sm text-slate-500 mt-1">Só hoje — descontos exclusivos dos nossos parceiros pagantes.</p>
      </div>

      <VitrinePaginada produtos={produtos} carregando={carregando} CardComponent={CardProdutoFechaMes} />
    </section>
  );
}

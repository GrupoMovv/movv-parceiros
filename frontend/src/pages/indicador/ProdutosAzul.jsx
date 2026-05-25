import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Package, CheckCircle } from 'lucide-react';

const FAIXAS = [
  { key: 'alta',  label: 'Faixa Alta',  pct: '1,0%',   color: 'text-green-600',  bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700' },
  { key: 'media', label: 'Faixa Média', pct: '0,7%',   color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'baixa', label: 'Faixa Baixa', pct: '0,2%',   color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',  badge: 'bg-slate-100 text-slate-600' },
];

export default function IndicadorProdutosAzul() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/indicators/products')
      .then(res => setProducts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4A0E8F]/10 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5 text-[#4A0E8F]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos Azul</h1>
          <p className="text-slate-500 text-sm">Tabela de comissões por produto</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#4A0E8F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FAIXAS.map(({ key, label, pct, color, bg, badge }) => {
            const prods = products.filter(p => p.category === key);
            return (
              <div key={key} className={`rounded-2xl border p-6 ${bg}`}>
                <div className="mb-5">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badge}`}>{label}</span>
                  <p className={`text-4xl font-black mt-3 ${color}`}>{pct}</p>
                  <p className="text-slate-500 text-xs mt-1">de comissão sobre a operação</p>
                </div>
                <ul className="space-y-2">
                  {prods.map(p => (
                    <li key={p.name} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${color}`} />
                      {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#4A0E8F]/5 border border-[#4A0E8F]/20 rounded-2xl p-5">
        <p className="text-slate-700 text-sm leading-relaxed">
          <strong className="text-[#4A0E8F]">Como funciona:</strong> A comissão é calculada sobre o valor total da operação contratada pelo cliente indicado. O pagamento é realizado via PIX após a conclusão e aprovação da operação.
        </p>
      </div>
    </div>
  );
}

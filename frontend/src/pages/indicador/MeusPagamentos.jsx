import { useState, useEffect } from 'react';
import api from '../../services/api';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';

function formatBRL(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle className="w-3 h-3" /> Pago
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
}

export default function IndicadorMeusPagamentos() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/indicators/my-payments')
      .then(res => setPayments(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalRecebido = payments.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
  const totalPendente = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4A0E8F]/10 rounded-xl flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-[#4A0E8F]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Pagamentos</h1>
          <p className="text-slate-500 text-sm">Histórico de pagamentos recebidos</p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-slate-500 text-sm mb-1">Total recebido</p>
            <p className="text-2xl font-bold text-green-600">{formatBRL(totalRecebido)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-slate-500 text-sm mb-1">Aguardando pagamento</p>
            <p className="text-2xl font-bold text-yellow-600">{formatBRL(totalPendente)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#4A0E8F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhum pagamento ainda</p>
            <p className="text-sm text-slate-400 mt-1">Os pagamentos aparecerão aqui após aprovação das indicações</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">#</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Valor</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Chave PIX</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Data pag.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Solicitado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500 text-sm">#{p.id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatBRL(p.total_amount)}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm font-mono">{p.pix_key}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

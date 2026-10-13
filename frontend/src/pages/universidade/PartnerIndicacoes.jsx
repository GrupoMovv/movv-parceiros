import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, Loader2, UserPlus } from 'lucide-react';
import api from '../../services/api';
import { dataBR } from './comissoesRotulos';

// Minhas indicações do MOVV Partner. O CPF do cliente aparece mascarado
// (o servidor já manda assim). O contrato quem preenche é a Central, ou ele
// entra sozinho quando a Azul paga e o admin confirma o vínculo.
const STATUS = {
  pending: 'Em andamento', converted: 'Convertida', expired: 'Prazo vencido', cancelled: 'Cancelada',
};

export default function PartnerIndicacoes() {
  const [lista, setLista] = useState(null);
  const [cpfEditando, setCpfEditando] = useState({});

  const carregar = useCallback(() => {
    api.get('/referrals').then(r => setLista(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Erro ao carregar suas indicações'));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvarCpf(id) {
    try {
      await api.patch(`/referrals/${id}/dados`, { client_cpf: (cpfEditando[id] || '').replace(/\D/g, '') });
      toast.success('CPF informado');
      setCpfEditando(c => { const n = { ...c }; delete n[id]; return n; });
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar o CPF');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-movv-900 flex items-center justify-center"><ClipboardList className="w-6 h-6 text-gold-300" /></div>
          <div>
            <h1 className="text-xl font-display font-semibold text-slate-900">Minhas indicações</h1>
            <p className="text-sm text-slate-500">MOVV Partner</p>
          </div>
        </div>
        <Link to="/indicar" className="btn-primary flex items-center gap-2"><UserPlus className="w-4 h-4" /> Indicar cliente</Link>
      </div>
      <p className="text-sm text-slate-600">Informe o CPF do cliente sempre que puder: é com ele que a Central liga a venda da Azul à sua indicação.</p>

      {!lista ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>
      ) : lista.length === 0 ? (
        <div className="card text-center py-10 text-slate-500 text-sm">Você ainda não tem indicações.</div>
      ) : (
        <div className="space-y-2">
          {lista.map(r => (
            <div key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{r.client_name}</p>
                <p className="text-xs text-slate-500">{r.product_name} · {dataBR(r.created_at)} · protocolo <span className="font-mono">{r.protocol}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">
                  CPF: {r.client_cpf ? <span className="font-mono">{r.client_cpf}</span> : <span className="text-amber-700">não informado</span>}
                  {' · '}Contrato: {r.numero_contrato ? <span className="font-mono">{r.numero_contrato}</span> : 'aguardando a Azul'}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{STATUS[r.status] || r.status}</span>
                {!r.client_cpf && (cpfEditando[r.id] === undefined ? (
                  <button className="text-xs text-movv-900 underline" onClick={() => setCpfEditando(c => ({ ...c, [r.id]: '' }))}>Informar CPF</button>
                ) : (
                  <div className="flex gap-1">
                    <input className="input py-1 text-sm w-40" inputMode="numeric" placeholder="CPF" value={cpfEditando[r.id]}
                      onChange={e => setCpfEditando(c => ({ ...c, [r.id]: e.target.value.replace(/[^\d.-]/g, '').slice(0, 14) }))} />
                    <button className="btn-primary text-xs px-3" onClick={() => salvarCpf(r.id)}>Salvar</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

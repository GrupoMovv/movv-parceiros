import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Bell, DownloadSimple } from '@phosphor-icons/react';

const PLANO_LABEL = { oficial: 'Oficial', premium: 'Premium', master: 'Master' };

function fmtDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR');
}

function baixarCsv(interessados) {
  const linhas = [
    ['Nome parceiro', 'Plano interesse', 'Data'],
    ...interessados.map(i => [i.parceiro_nome, PLANO_LABEL[i.plano_interesse] || i.plano_interesse, fmtDataHora(i.created_at)]),
  ];
  const csv = linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `interessados-planos-iub-mais-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SindicatoParceiroInteressados() {
  const [interessados, setInteressados] = useState(null);
  const [totalPorPlano, setTotalPorPlano] = useState({});
  const [filtro, setFiltro] = useState('');

  const carregar = useCallback(() => {
    const params = {};
    if (filtro) params.plano = filtro;
    api.get('/sindicato-parceiro-interessados', { params })
      .then(res => { setInteressados(res.data.interessados); setTotalPorPlano(res.data.total_por_plano); })
      .catch(() => toast.error('Erro ao carregar interessados'));
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalGeral = Object.values(totalPorPlano).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell size={22} weight="duotone" className="text-movv-900" /> Interessados em Planos — IUB MAIS
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Parceiros que clicaram em "Notificar-me" na página de Planos (em breve) — {totalGeral} no total.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['oficial', 'premium', 'master'].map(p => (
          <div key={p} className="card py-4 text-center">
            <p className="text-2xl font-bold text-movv-900">{totalPorPlano[p] || 0}</p>
            <p className="text-slate-500 text-xs mt-0.5">{PLANO_LABEL[p]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[['', 'Todos'], ['oficial', 'Oficial'], ['premium', 'Premium'], ['master', 'Master']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtro === v ? 'bg-movv-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => baixarCsv(interessados || [])}
          disabled={!interessados?.length}
          className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
        >
          <DownloadSimple size={16} /> Exportar CSV
        </button>
      </div>

      <div className="card">
        {interessados === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : interessados.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhum interessado ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Nome parceiro', 'Plano interesse', 'Data'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interessados.map(i => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 text-slate-900 font-medium whitespace-nowrap">{i.parceiro_nome}</td>
                    <td className="py-3 pr-4 text-slate-600">{PLANO_LABEL[i.plano_interesse] || i.plano_interesse}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{fmtDataHora(i.created_at)}</td>
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

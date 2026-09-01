import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import {
  Building2, Loader2, Search, Upload, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, History, FileSpreadsheet,
} from 'lucide-react';

const LIMIT = 20;

const STATUS_LABEL = {
  adimplente: { label: 'Adimplente', cls: 'bg-emerald-100 text-emerald-700' },
  atrasada:   { label: 'Atrasada',   cls: 'bg-red-100 text-red-700' },
  inativa:    { label: 'Inativa',    cls: 'bg-slate-100 text-slate-500' },
};

function fmtCnpj(v) {
  const d = String(v || '').replace(/\D/g, '').padStart(14, '0');
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function fmtMoeda(v) {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export default function SindicatoContribuintes() {
  const [stats, setStats] = useState(null);
  const [contribuintes, setContribuintes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const [historico, setHistorico] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const [modalUpload, setModalUpload] = useState(false);
  const [processandoArquivo, setProcessandoArquivo] = useState(false);
  const [preview, setPreview] = useState(null); // { resumo, empresas }
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFiltro) params.status = statusFiltro;
      const res = await api.get('/sindicato-contribuintes', { params });
      setContribuintes(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error('Erro ao carregar contribuintes');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFiltro]);

  const carregarStats = useCallback(() => {
    api.get('/sindicato-contribuintes/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const carregarHistorico = useCallback(() => {
    api.get('/sindicato-contribuintes/importacoes').then(res => setHistorico(res.data)).catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarStats(); carregarHistorico(); }, [carregarStats, carregarHistorico]);

  async function handleArquivoSelecionado(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setProcessandoArquivo(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await api.post('/sindicato-contribuintes/upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao processar planilha');
    } finally {
      setProcessandoArquivo(false);
    }
  }

  async function handleConfirmarImportacao() {
    if (!preview) return;
    setConfirmando(true);
    try {
      await api.post('/sindicato-contribuintes/upload/confirmar', { empresas: preview.empresas });
      toast.success('Importação confirmada!');
      setModalUpload(false);
      setPreview(null);
      setPage(1);
      carregar();
      carregarStats();
      carregarHistorico();
    } catch {
      toast.error('Erro ao confirmar importação');
    } finally {
      setConfirmando(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-movv-900" /> Empresas Contribuintes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Base de status de pagamento (guia mensal) — controla quem pode se autocadastrar em /cadastrar
          </p>
        </div>
        <button onClick={() => setModalUpload(true)} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Fazer upload da planilha
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Adimplentes" value={stats.adimplentes} accentCls="text-emerald-600" />
          <StatCard label="Atrasadas" value={stats.atrasadas} accentCls="text-red-600" />
          <StatCard label="Última atualização" value={fmtDataHora(stats.ultima_atualizacao).split(' ')[0]} small />
        </div>
      )}

      <div className="card">
        <button
          onClick={() => setMostrarHistorico(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-movv-900 transition-colors"
        >
          <History className="w-4 h-4" /> Histórico de importações {mostrarHistorico ? '▲' : '▼'}
        </button>
        {mostrarHistorico && (
          <div className="mt-4 divide-y divide-slate-100">
            {historico.length === 0 && <p className="text-slate-400 text-sm py-2">Nenhuma importação registrada ainda.</p>}
            {historico.map(h => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-slate-800 font-medium">{fmtDataHora(h.created_at)} — {h.importado_por_nome || 'Sistema'}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {h.total_linhas} linhas · {h.novas} novas · {h.atualizadas} atualizadas · {h.status_mudou} mudaram de status
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por razão social, fantasia ou CNPJ..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
          <select
            value={statusFiltro}
            onChange={e => { setStatusFiltro(e.target.value); setPage(1); }}
            className="input sm:w-48"
          >
            <option value="">Todos os status</option>
            <option value="adimplente">Adimplente</option>
            <option value="atrasada">Atrasada</option>
            <option value="inativa">Inativa</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : contribuintes.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhuma empresa encontrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">CNPJ</th>
                  <th className="py-2 pr-3">Cidade</th>
                  <th className="py-2 pr-3">Meses pagos</th>
                  <th className="py-2 pr-3">Total pago</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contribuintes.map(c => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-800 font-medium">{c.nome_fantasia || c.razao_social}</p>
                      {c.nome_fantasia && <p className="text-slate-400 text-xs">{c.razao_social}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{fmtCnpj(c.cnpj)}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{c.cidade || '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{c.meses_pagos ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{fmtMoeda(c.total_pago_periodo)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_LABEL[c.status]?.cls}`}>
                        {STATUS_LABEL[c.status]?.label || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages} · {total} empresas</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalUpload}
        onClose={() => { setModalUpload(false); setPreview(null); }}
        title="Upload da planilha de empresas pagantes"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {!preview && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-10 cursor-pointer hover:border-movv-900/40 transition-colors">
              <FileSpreadsheet className="w-8 h-8 text-slate-300" />
              <span className="text-slate-500 text-sm">
                {processandoArquivo ? 'Processando...' : 'Clique para selecionar o arquivo .xlsx'}
              </span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArquivoSelecionado} disabled={processandoArquivo} />
            </label>
          )}

          {processandoArquivo && (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{preview.resumo.novas}</p>
                  <p className="text-emerald-700 text-xs font-medium mt-0.5">Novas</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{preview.resumo.atualizadas}</p>
                  <p className="text-blue-700 text-xs font-medium mt-0.5">Atualizadas</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{preview.resumo.status_mudou}</p>
                  <p className="text-amber-700 text-xs font-medium mt-0.5">Status mudou</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {preview.resumo.total_linhas} linhas reconhecidas na planilha
              </p>
              <div className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 rounded-xl p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Confirme só depois de revisar os números acima — a importação substitui o status de pagamento das empresas já cadastradas.
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setPreview(null)} className="btn-secondary">Escolher outro arquivo</button>
                <button
                  onClick={handleConfirmarImportacao}
                  disabled={confirmando}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar importação
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, accentCls, small }) {
  return (
    <div className="card">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`${small ? 'text-base' : 'text-2xl'} font-bold mt-1 ${accentCls || 'text-slate-900'}`}>{value ?? '—'}</p>
    </div>
  );
}

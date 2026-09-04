import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';
import {
  ArrowLeft, Loader2, Search, MessageCircle, Ban, RotateCcw, Copy,
} from 'lucide-react';

function fmtCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function fmtCnpj(cnpj) {
  const d = String(cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const STATUS_BADGE = {
  pendente_ativacao: { label: 'Pendente', cls: 'badge-pending' },
  ativado: { label: 'Ativado', cls: 'badge-converted' },
  cancelado: { label: 'Cancelado', cls: 'badge-expired' },
};

function montarMensagemPersonalizada(nome) {
  const primeiroNome = String(nome || '').trim().split(/\s+/)[0];
  const link = `${window.location.origin}/cadastrar-associado`;
  return `Olá, ${primeiroNome}! 👋

Sua carteirinha SECI + IUB MAIS já está disponível — é só ativar em 2 minutos:
👉 ${link}

Você vai precisar do seu CPF e do CNPJ da sua empresa (peça ao RH se não souber).

Depois de ativar você ganha carteirinha digital + descontos exclusivos no marketplace IUB MAIS!`;
}

export default function SindicatoListaAprovadosEmpresaDetalhe() {
  const { nome } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [search, setSearch] = useState('');
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
  const [processando, setProcessando] = useState(false);

  const load = useCallback(async (filtros = {}) => {
    setLoading(true);
    try {
      const res = await api.get(`/sindicato-lista-aprovada/empresas/${encodeURIComponent(nome)}`, { params: filtros });
      setDados(res.data);
    } catch { toast.error('Erro ao carregar dados da empresa'); }
    finally { setLoading(false); }
  }, [nome]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load({ status: status || undefined, cnpj: cnpj || undefined, search: search || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, cnpj, search]);

  async function copiarMensagem(nomeColaborador) {
    try {
      await navigator.clipboard.writeText(montarMensagemPersonalizada(nomeColaborador));
      toast.success('Mensagem copiada!');
    } catch { toast.error('Não foi possível copiar'); }
  }

  async function handleCancelar(id) {
    setProcessando(true);
    try {
      await api.put(`/sindicato-lista-aprovada/${id}/cancelar`);
      toast.success('Acesso cancelado');
      setColaboradorSelecionado(null);
      load({ status: status || undefined, cnpj: cnpj || undefined, search: search || undefined });
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao cancelar'); }
    finally { setProcessando(false); }
  }

  async function handleReativar(id) {
    setProcessando(true);
    try {
      await api.put(`/sindicato-lista-aprovada/${id}/reativar`);
      toast.success('Acesso reativado');
      setColaboradorSelecionado(null);
      load({ status: status || undefined, cnpj: cnpj || undefined, search: search || undefined });
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao reativar'); }
    finally { setProcessando(false); }
  }

  if (loading && !dados) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );
  if (!dados) return null;

  const { stats, filiais, colaboradores } = dados;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Link to="/sindicato/lista-aprovados" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Lista de Aprovados
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{nome}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total" valor={stats.total} />
        <StatCard label="Ativados" valor={stats.ativados} cls="text-emerald-600" />
        <StatCard label="Pendentes" valor={stats.pendentes} cls="text-amber-600" />
        <StatCard label="Cancelados" valor={stats.cancelados} cls="text-red-500" />
        <StatCard label="Conversão" valor={`${stats.taxa_conversao}%`} cls="text-[#0C2D48]" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pendente_ativacao">Pendente</option>
          <option value="ativado">Ativado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        {filiais.length > 1 && (
          <select className="input w-auto" value={cnpj} onChange={e => setCnpj(e.target.value)}>
            <option value="">Todas as filiais</option>
            {filiais.map(f => <option key={f.cnpj} value={f.cnpj}>{fmtCnpj(f.cnpj)} ({f.total})</option>)}
          </select>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Nome', 'CPF', 'Filial (CNPJ)', 'Matrícula', 'Status', 'Importado em', 'Ativado em', ''].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : colaboradores.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Nenhum colaborador encontrado</td></tr>
              ) : colaboradores.map(c => {
                const badge = STATUS_BADGE[c.status] || STATUS_BADGE.pendente_ativacao;
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-900 font-medium whitespace-nowrap">{c.nome_colaborador}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">{fmtCpf(c.cpf_colaborador)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">{fmtCnpj(c.cnpj_empresa)}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{c.matricula_interna || '—'}</td>
                    <td className="py-3 px-4"><span className={badge.cls}>{badge.label}</span></td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{fmtData(c.data_importacao)}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{fmtData(c.ativado_em)}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => setColaboradorSelecionado(c)} className="text-xs font-semibold text-[#0C2D48] hover:underline whitespace-nowrap">
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!colaboradorSelecionado} onClose={() => setColaboradorSelecionado(null)} title={colaboradorSelecionado?.nome_colaborador}>
        {colaboradorSelecionado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Campo label="CPF" valor={fmtCpf(colaboradorSelecionado.cpf_colaborador)} />
              <Campo label="Filial (CNPJ)" valor={fmtCnpj(colaboradorSelecionado.cnpj_empresa)} />
              <Campo label="Matrícula" valor={colaboradorSelecionado.matricula_interna || '—'} />
              <Campo label="Valor mensal" valor={parseFloat(colaboradorSelecionado.valor_mensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Campo label="Status" valor={STATUS_BADGE[colaboradorSelecionado.status]?.label} />
              <Campo label="Importado em" valor={fmtData(colaboradorSelecionado.data_importacao)} />
              {colaboradorSelecionado.ativado_em && <Campo label="Ativado em" valor={fmtData(colaboradorSelecionado.ativado_em)} />}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
              {colaboradorSelecionado.status === 'pendente_ativacao' && (
                <>
                  <button onClick={() => copiarMensagem(colaboradorSelecionado.nome_colaborador)} className="btn-secondary flex items-center justify-center gap-2">
                    <Copy className="w-4 h-4" /> Copiar mensagem de lembrete
                  </button>
                  <button
                    onClick={() => handleCancelar(colaboradorSelecionado.id)} disabled={processando}
                    className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" /> Cancelar acesso
                  </button>
                </>
              )}
              {colaboradorSelecionado.status === 'cancelado' && (
                <button
                  onClick={() => handleReativar(colaboradorSelecionado.id)} disabled={processando}
                  className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Reativar acesso
                </button>
              )}
              {colaboradorSelecionado.status === 'ativado' && (
                <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> Já ativou a carteirinha — sem ações pendentes.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, valor, cls = 'text-slate-900' }) {
  return (
    <div className="card text-center py-4">
      <p className={`text-2xl font-bold ${cls}`}>{valor}</p>
      <p className="text-[11px] text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function Campo({ label, valor }) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-slate-900 font-medium">{valor}</p>
    </div>
  );
}

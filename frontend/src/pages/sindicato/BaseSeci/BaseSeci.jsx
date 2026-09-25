import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Landmark, Loader2, Search, Upload, Download, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, History, FileSpreadsheet, TrendingUp, TrendingDown, Pin, Eye, UserPlus,
} from 'lucide-react';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtMes(mes) {
  if (!mes) return '—';
  const [ano, m] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${ano}`;
}

function fmtMoeda(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataHora(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—';
}

export default function BaseSeci() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [empresas, setEmpresas] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [historico, setHistorico] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (busca) params.busca = busca;
      if (status) params.status = status;
      const res = await api.get('/sindicato/base-seci', { params });
      setEmpresas(res.data.data);
      setTotal(res.data.total);
      setLimit(res.data.limit);
      setStats(res.data.stats);
    } catch {
      toast.error('Erro ao carregar a base SECI');
    } finally {
      setLoading(false);
    }
  }, [page, busca, status]);

  const carregarHistorico = useCallback(() => {
    api.get('/sindicato/base-seci/historico').then(res => setHistorico(res.data)).catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  async function exportar() {
    setExportando(true);
    try {
      const res = await api.get('/sindicato/base-seci/exportar', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `base-seci-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao exportar');
    } finally {
      setExportando(false);
    }
  }

  async function alternarSempreAtiva(e) {
    const ligar = !e.sempre_ativa;
    const msg = ligar
      ? `Fixar "${e.nome_fantasia || e.razao_social}" como SEMPRE EM DIA? Ela nunca vira devendo, mesmo sem aparecer no relatório.`
      : `Tirar "${e.nome_fantasia || e.razao_social}" do "sempre em dia"? A situação volta a seguir a regra dos 3 meses.`;
    if (!window.confirm(msg)) return;
    try {
      await api.patch(`/sindicato/base-seci/${e.id}/sempre-ativa`, { sempre_ativa: ligar, observacoes_ativacao: e.observacoes_ativacao });
      toast.success('Atualizado');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const arr = stats?.arrecadado;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-movv-900" /> Base SECI
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Quem está em dia com o Sindicato — libera o cadastro de associado e o preço de sindicalizada nos planos.
            Em dia = pagou no mês do último relatório ou nos 2 anteriores.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex gap-2 flex-wrap items-center">
            <StatusWhatsapp />
            <IpDetectado />
            <button onClick={exportar} disabled={exportando} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar base atual
            </button>
            <button onClick={() => setModalImportar(true)} className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Atualizar base do mês
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Somente leitura
          </span>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total na base" value={stats.total} />
          <StatCard label="Em dia" value={stats.em_dia} accentCls="text-emerald-600" />
          <StatCard label="Devendo" value={stats.devendo} accentCls="text-red-600" />
          <StatCard label={arr ? `Arrecadado ${fmtMes(arr.mes)}` : 'Arrecadado no mês'} value={arr ? fmtMoeda(arr.valor) : '—'} accentCls="text-movv-900" small />
          <div className="card col-span-2 lg:col-span-1">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
              {arr ? `vs ${fmtMes(arr.mes_anterior)}` : 'Mês anterior'}
            </p>
            {arr?.variacao_pct != null ? (
              <>
                <p className={`text-base font-bold mt-1 flex items-center gap-1 ${arr.variacao_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {arr.variacao_pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {arr.variacao_pct > 0 ? '+' : ''}{arr.variacao_pct.toLocaleString('pt-BR')}%
                </p>
                <p className="text-slate-400 text-xs mt-0.5">{fmtMoeda(arr.valor_anterior)}</p>
              </>
            ) : (
              <p className="text-slate-400 text-xs mt-2">Sem importação do mês anterior</p>
            )}
          </div>
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
            {historico.length === 0 && <p className="text-slate-400 text-sm py-2">Nenhuma importação ainda.</p>}
            {historico.map(h => (
              <div key={h.id} className="py-2.5 text-sm">
                <p className="text-slate-800 font-medium">
                  {fmtMes(h.mes_referencia)} · {fmtMoeda(h.total_arrecadado)}
                  <span className="text-slate-400 font-normal"> — {fmtDataHora(h.criado_em)} por {h.importado_por_nome || 'Sistema'}</span>
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {h.total_empresas} no arquivo · {h.novos} novos · {h.renovados} renovaram
                  {h.voltaram_em_dia > 0 && ` · ${h.voltaram_em_dia} voltaram a ficar em dia`}
                  {' · '}{h.marcados_devendo} marcados devendo · {h.total_em_dia_depois} em dia depois
                  {h.arquivo_nome && ` · ${h.arquivo_nome}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <NovosAssociados />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por CNPJ/CPF, razão social ou fantasia..."
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input sm:w-44">
            <option value="">Todos</option>
            <option value="em_dia">Em dia</option>
            <option value="devendo">Devendo</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : empresas.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhuma empresa encontrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">CNPJ/CPF</th>
                  <th className="py-2 pr-3">Cód. filiado</th>
                  <th className="py-2 pr-3">Último pagamento</th>
                  <th className="py-2 pr-3">Situação</th>
                  {isAdmin && <th className="py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {empresas.map(e => (
                  <tr key={e.id}>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-800 font-medium">{e.nome_fantasia || e.razao_social}</p>
                      {e.nome_fantasia && e.nome_fantasia !== e.razao_social && <p className="text-slate-400 text-xs">{e.razao_social}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {e.documento_exibicao}
                      {e.tipo_documento === 'cpf' && <span className="ml-1.5 font-sans text-[10px] font-semibold bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">CPF</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{e.codigo_filiado || '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                      {fmtMes(e.mes_referencia)}
                      {e.ultimo_valor_pago != null && <span className="text-slate-400 text-xs"> · {fmtMoeda(e.ultimo_valor_pago)}</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${e.em_dia ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {e.em_dia ? 'Em dia' : 'Devendo'}
                        </span>
                        {e.sempre_ativa && (
                          <span title={e.observacoes_ativacao || 'Sempre em dia'} className="text-xs font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700">
                            Sempre ativa
                          </span>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => alternarSempreAtiva(e)}
                          title={e.sempre_ativa ? 'Tirar do "sempre em dia"' : 'Fixar como sempre em dia'}
                          className={`p-1.5 rounded-lg hover:bg-slate-100 ${e.sempre_ativa ? 'text-violet-600' : 'text-slate-300'}`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      </td>
                    )}
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

      {isAdmin && (
        <ModalImportar
          open={modalImportar}
          onClose={() => setModalImportar(false)}
          onImportado={() => { setModalImportar(false); setPage(1); carregar(); carregarHistorico(); }}
        />
      )}
    </div>
  );
}

function ModalImportar({ open, onClose, onImportado }) {
  const [arquivo, setArquivo] = useState(null);
  const [mesInformado, setMesInformado] = useState('');
  const [pedirMes, setPedirMes] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  function resetar() {
    setArquivo(null); setMesInformado(''); setPedirMes(false); setPreview(null);
  }

  function fechar() {
    resetar();
    onClose();
  }

  function montarForm(file, mes) {
    const fd = new FormData();
    fd.append('arquivo', file);
    if (mes) fd.append('mes_referencia', mes);
    return fd;
  }

  async function gerarPreview(file, mes) {
    setProcessando(true);
    setPreview(null);
    try {
      const res = await api.post('/sindicato/base-seci/importar/preview', montarForm(file, mes), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err) {
      if (err.response?.data?.code === 'MES_OBRIGATORIO') setPedirMes(true);
      toast.error(err.response?.data?.error || 'Erro ao ler o arquivo');
    } finally {
      setProcessando(false);
    }
  }

  function onArquivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setArquivo(file);
    setPedirMes(false);
    gerarPreview(file, '');
  }

  async function confirmar() {
    setConfirmando(true);
    try {
      const res = await api.post('/sindicato/base-seci/importar', montarForm(arquivo, pedirMes ? mesInformado : ''), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Base atualizada! ${res.data.total_em_dia_depois} empresas em dia.`);
      resetar();
      onImportado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao importar');
    } finally {
      setConfirmando(false);
    }
  }

  const a = preview?.arquivo;

  return (
    <Modal open={open} onClose={fechar} title="Atualizar base do mês" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {!preview && !processando && (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-10 cursor-pointer hover:border-movv-900/40 transition-colors text-center px-4">
            <FileSpreadsheet className="w-8 h-8 text-slate-300" />
            <span className="text-slate-600 text-sm font-medium">{arquivo ? arquivo.name : 'Selecione o Relatório de Recebimentos do Higestor'}</span>
            <span className="text-slate-400 text-xs">.xlsx, .xls ou .csv — o sistema acha o cabeçalho sozinho</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArquivo} />
          </label>
        )}

        {pedirMes && !preview && arquivo && (
          <div className="flex items-end gap-2 bg-amber-50 rounded-xl p-3">
            <label className="flex-1 text-sm text-amber-800">
              Mês de referência do arquivo
              <input type="month" value={mesInformado} onChange={e => setMesInformado(e.target.value)} className="input mt-1" />
            </label>
            <button disabled={!mesInformado || processando} onClick={() => gerarPreview(arquivo, mesInformado)} className="btn-primary disabled:opacity-50">
              Ler de novo
            </button>
          </div>
        )}

        {processando && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}

        {preview && (
          <>
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <p><strong>{a.nome}</strong></p>
              {a.filtro && <p>{a.filtro}</p>}
              <p>
                Mês do arquivo: <strong>{fmtMes(preview.mes_referencia)}</strong>
                {a.origem_mes === 'informado' && ' (informado por você)'}
                {a.origem_mes === 'pagamentos' && ' (pela data de pagamento mais recente)'}
                {' · '}em dia = pagou entre {fmtMes(preview.janela_em_dia.inicio)} e {fmtMes(preview.janela_em_dia.fim)}
              </p>
              <p>
                {a.total_pagamentos} pagamentos de {preview.total_empresas} CPFs/CNPJs · arrecadado em {fmtMes(preview.mes_referencia)}: <strong>{fmtMoeda(a.total_arrecadado)}</strong>
                {a.titulos_quitados && ' · relatório de títulos quitados'}
              </p>
            </div>

            {preview.erro_arquivo_antigo && (
              <div className="flex items-start gap-1.5 text-red-700 text-sm bg-red-50 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {preview.erro_arquivo_antigo}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Numero valor={preview.novos} rotulo="CNPJs/CPFs novos" cls="emerald" />
              <Numero valor={preview.renovados} rotulo="Renovaram (em dia)" cls="blue" />
              <Numero valor={preview.marcar_devendo} rotulo="Ausentes → devendo" cls="red" />
            </div>

            <ul className="text-xs text-slate-500 space-y-1">
              {preview.voltaram_em_dia > 0 && <li>↩︎ {preview.voltaram_em_dia} estavam devendo e voltam a ficar em dia</li>}
              <li>⏳ {preview.ausentes_em_tolerancia} não pagaram neste mês mas continuam em dia (dentro dos 3 meses ou sempre ativa)</li>
              {preview.fora_da_janela > 0 && <li>{preview.fora_da_janela} aparecem no arquivo só com pagamento anterior a {fmtMes(preview.janela_em_dia.inicio)} (ficam devendo)</li>}
              {a.linhas_ignoradas > 0 && (
                <li className="text-amber-700">
                  {a.linhas_ignoradas} linha(s) ignoradas por CPF/CNPJ inválido
                  {a.exemplos_ignorados.length > 0 && ` (ex.: linha ${a.exemplos_ignorados.map(x => x.linha).join(', ')})`}
                </li>
              )}
              {a.linhas_sem_pagamento > 0 && <li>{a.linhas_sem_pagamento} linha(s) sem Valor Pago não contaram como pagamento</li>}
            </ul>

            <Amostra titulo="Ficam devendo" itens={preview.amostras.marcar_devendo} total={preview.marcar_devendo} />
            <Amostra titulo="Novos na base" itens={preview.amostras.novos} total={preview.novos} />
            <Amostra titulo="Voltam a ficar em dia" itens={preview.amostras.voltaram} total={preview.voltaram_em_dia} />

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={resetar} className="btn-secondary">Escolher outro arquivo</button>
              <button
                onClick={confirmar}
                disabled={confirmando || !!preview.erro_arquivo_antigo}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar e aplicar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const CORES = {
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  red: 'bg-red-50 border-red-100 text-red-700',
};

function Numero({ valor, rotulo, cls }) {
  return (
    <div className={`border rounded-xl p-3 text-center ${CORES[cls]}`}>
      <p className="text-2xl font-bold">{valor}</p>
      <p className="text-xs font-medium mt-0.5">{rotulo}</p>
    </div>
  );
}

function Amostra({ titulo, itens, total }) {
  if (!total) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-600 font-semibold">{titulo} ({total})</summary>
      <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg">
        {itens.map(e => (
          <li key={e.documento} className="px-2 py-1.5 flex justify-between gap-2">
            <span className="text-slate-700 truncate">{e.nome_fantasia || e.razao_social}</span>
            <span className="text-slate-400 font-mono whitespace-nowrap">{e.documento}</span>
          </li>
        ))}
        {total > itens.length && <li className="px-2 py-1.5 text-slate-400">… e mais {total - itens.length}</li>}
      </ul>
    </details>
  );
}

// Chip do WhatsApp (Z-API) que manda código de senha e avisos da carteirinha.
// Conferência do Renan: quem virou associado por empresa no período. CNPJ é
// público, então empresa com muitos novos ganha o selo "conferir".
function NovosAssociados() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    setDados(null);
    api.get('/sindicato/base-seci/novos-associados', { params: { dias } }).then(r => setDados(r.data)).catch(() => setDados({ empresas: [], total_novos: 0, erro: true }));
  }, [dias]);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Novos associados por empresa</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Quem virou associado pelo IUB MAIS+ (cadastro ou ativação no painel). Confira com a empresa as que tiverem o selo.
          </p>
        </div>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} className="input w-40">
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>
      {!dados ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : dados.empresas.length === 0 ? (
        <p className="text-slate-400 text-sm py-4">{dados.erro ? 'Não deu pra carregar agora.' : 'Nenhum associado novo no período.'}</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100">
          <p className="text-xs text-slate-500 pb-2">{dados.total_novos} novo(s) em {dados.empresas.length} empresa(s)/filiado(s)</p>
          {dados.empresas.map(e => (
            <div key={e.id} className="py-2">
              <button type="button" onClick={() => setAberta(aberta === e.id ? null : e.id)} className="w-full flex items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="text-sm font-medium text-slate-800">{e.nome_fantasia || e.razao_social}</span>
                  <span className="text-xs text-slate-400 font-mono ml-2">{e.documento_exibicao}</span>
                  {!e.em_dia && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">devendo</span>}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {e.conferir && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠️ conferir</span>}
                  <span className="text-sm font-bold text-slate-700">{e.novos}</span>
                </span>
              </button>
              {aberta === e.id && (
                <ul className="mt-2 ml-2 space-y-1">
                  {e.pessoas.map(p => (
                    <li key={p.id} className="text-xs text-slate-600 flex items-center justify-between gap-2">
                      <span>{p.nome} <span className="text-slate-400">· desde {new Date(p.desde).toLocaleDateString('pt-BR')}</span></span>
                      {p.whatsapp && (
                        <a href={`https://api.whatsapp.com/send?phone=55${p.whatsapp}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold">WhatsApp</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Conferência do limite por IP em produção: tem que ser o IP de quem está
// usando (o seu), não o do Render. Se não bater, ajustar TRUST_PROXY_HOPS
// no Render (ver backend/src/utils/ipCliente.js).
function IpDetectado() {
  const [ip, setIp] = useState(null);
  useEffect(() => {
    api.get('/sindicato/base-seci/diagnostico-ip').then(r => setIp(r.data.ip_detectado)).catch(() => {});
  }, []);
  if (!ip) return null;
  return (
    <span
      title="Deve ser o SEU IP (confira em meuip.com.br). Se aparecer outro, avise — é o IP usado nos limites de tentativas."
      className="text-xs font-semibold rounded-full px-3 py-1.5 bg-slate-100 text-slate-600"
    >
      Seu IP visto pelo sistema: {ip}
    </span>
  );
}

function StatusWhatsapp() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    api.get('/sindicato/base-seci/whatsapp-status').then(r => setSt(r.data)).catch(() => setSt({ conectado: false, erro: 'não deu pra consultar' }));
  }, []);
  if (!st) return null;
  return (
    <span
      title={st.erro || (st.conectado ? 'Códigos de senha e avisos da carteirinha saindo normalmente' : 'Chip desconectado')}
      className={`text-xs font-semibold rounded-full px-3 py-1.5 ${st.conectado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
    >
      WhatsApp {st.conectado ? 'conectado' : `com problema${st.erro ? `: ${st.erro}` : ''}`}
    </span>
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

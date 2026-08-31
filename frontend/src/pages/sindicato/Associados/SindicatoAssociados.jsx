import { useEffect, useState, useCallback } from 'react';
import api, { assetUrl } from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import {
  Contact, Loader2, Search, Plus, Pencil, Send, Users2, Power,
  ChevronLeft, ChevronRight, CheckSquare, Square, ArrowRight, X,
  QrCode, RefreshCw, Camera, CreditCard,
} from 'lucide-react';
import { iniciais, corAvatar } from '../../../utils/avatar';
import {
  publicCarteirinhaUrl, carteirinhaBadge, linkWhatsapp, enviarCarteirinhaWhatsapp,
} from '../../../utils/carteirinhaWhatsapp';

const LIMIT = 20;
const CATEGORIAS = ['Empregado', 'Empregador patronal', 'Profissional liberal', 'Autonomo', 'Outros'];
const GRAUS_DEPENDENTE = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];
const DEPENDENTE_VAZIO = { nome: '', grau: '', data_nascimento: '' };

const EMPTY_FORM = {
  nome_completo: '', cpf: '', data_nascimento: '', sexo: '', categoria_profissional: '',
  codigo_filiado: '', celular: '', whatsapp: '', email: '', cidade: '', estado: '',
  observacoes: '', dependentes: [], empresa_id: null, empresa_nome_livre: '',
  dependentes_gerar_carteirinha: true,
};

function maskCPF(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function fmtData(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export default function SindicatoAssociados() {
  const [associados, setAssociados] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('ativo');
  const [whatsappFiltro, setWhatsappFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState([]);

  const [modalForm, setModalForm] = useState(null); // 'create' | 'edit'
  const [formAlvoId, setFormAlvoId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [empresaModoLivre, setEmpresaModoLivre] = useState(false);
  const [empresaLabelAtual, setEmpresaLabelAtual] = useState('');
  const [empresaBusca, setEmpresaBusca] = useState('');
  const [empresaOpcoes, setEmpresaOpcoes] = useState([]);

  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoAtualUrl, setFotoAtualUrl] = useState(null);

  const [gerandoCarteirinhaId, setGerandoCarteirinhaId] = useState(null);
  const [enviandoCarteirinhaId, setEnviandoCarteirinhaId] = useState(null);
  const [enviandoFotoDependenteIdx, setEnviandoFotoDependenteIdx] = useState(null);

  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const [modalEnviar, setModalEnviar] = useState(null);
  const [templateEnviarId, setTemplateEnviarId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [modalMassa, setModalMassa] = useState(false);
  const [associadosMassa, setAssociadosMassa] = useState([]);
  const [loadingMassa, setLoadingMassa] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [templateMassaId, setTemplateMassaId] = useState(null);
  const [filaLinks, setFilaLinks] = useState(null);
  const [filaIndex, setFilaIndex] = useState(0);
  const [iniciandoMassa, setIniciandoMassa] = useState(false);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-associados', {
        params: {
          page: p, limit: LIMIT,
          search: search || undefined,
          categoria: categoria || undefined,
          status: status || undefined,
          whatsapp: whatsappFiltro || undefined,
        },
      });
      setAssociados(res.data.data);
      setTotal(res.data.total);
    } catch { toast.error('Erro ao carregar associados'); }
    finally { setLoading(false); }
  }, [page, search, categoria, status, whatsappFiltro]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/sindicato-associados/stats');
      setStats(res.data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { setPage(1); load(1); loadStats(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search, categoria, status, whatsappFiltro]);
  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  useEffect(() => {
    api.get('/sindicato-beneficios/templates').then(res => setTemplates(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!empresaBusca.trim()) { setEmpresaOpcoes([]); return; }
      try {
        const res = await api.get('/sindicato-empresas/empresas', { params: { search: empresaBusca } });
        setEmpresaOpcoes(res.data);
      } catch { /* silencioso */ }
    }, 300);
    return () => clearTimeout(t);
  }, [empresaBusca]);

  function resetCamposCarteirinha() {
    setEmpresaModoLivre(false);
    setEmpresaLabelAtual('');
    setEmpresaBusca('');
    setEmpresaOpcoes([]);
    setFotoFile(null);
    setFotoPreview(null);
    setFotoAtualUrl(null);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    resetCamposCarteirinha();
    setModalForm('create');
  }

  async function openEdit(id) {
    setModalForm('edit');
    setFormAlvoId(id);
    setForm(EMPTY_FORM);
    resetCamposCarteirinha();
    try {
      const res = await api.get(`/sindicato-associados/${id}`);
      const a = res.data;
      setForm({
        nome_completo: a.nome_completo || '', cpf: a.cpf || '',
        data_nascimento: a.data_nascimento ? a.data_nascimento.slice(0, 10) : '',
        sexo: a.sexo || '', categoria_profissional: a.categoria_profissional || '',
        codigo_filiado: a.codigo_filiado || '', celular: a.celular || '', whatsapp: a.whatsapp || '',
        email: a.email || '', cidade: a.cidade || '', estado: a.estado || '',
        observacoes: a.observacoes || '',
        dependentes: a.dependentes.map(d => ({
          id: d.id, nome: d.nome, grau: d.grau || '', foto_url: d.foto_url || null,
          data_nascimento: d.data_nascimento ? d.data_nascimento.slice(0, 10) : '',
        })),
        empresa_id: a.empresa_id || null,
        empresa_nome_livre: a.empresa_nome_livre || '',
        dependentes_gerar_carteirinha: a.dependentes_gerar_carteirinha,
      });
      setEmpresaModoLivre(!a.empresa_id && !!a.empresa_nome_livre);
      setEmpresaLabelAtual(a.empresa_nome || '');
      setFotoAtualUrl(a.foto_url || null);
    } catch { toast.error('Erro ao carregar associado'); setModalForm(null); }
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        empresa_nome_livre: empresaModoLivre ? form.empresa_nome_livre : '',
        empresa_id: empresaModoLivre ? null : form.empresa_id,
      };
      let alvoId = formAlvoId;
      if (modalForm === 'create') {
        const res = await api.post('/sindicato-associados', payload);
        alvoId = res.data.id;
        toast.success('Associado cadastrado!');
      } else {
        await api.put(`/sindicato-associados/${formAlvoId}`, payload);
        toast.success('Associado atualizado!');
      }

      if (modalForm === 'edit' && alvoId) {
        await api.put(`/sindicato-carteirinha/associados/${alvoId}/empresa`, {
          empresa_id: payload.empresa_id || undefined,
          empresa_nome_livre: payload.empresa_nome_livre || undefined,
        });
        if (fotoFile) {
          const fd = new FormData();
          fd.append('foto', fotoFile);
          await api.put(`/sindicato-carteirinha/associados/${alvoId}/foto`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      setModalForm(null);
      load(page); loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar associado');
    } finally { setSaving(false); }
  }

  async function handleGerarRenovar(a) {
    setGerandoCarteirinhaId(a.id);
    try {
      const acao = a.carteirinha_hash ? 'renovar' : 'gerar';
      await api.post(`/sindicato-carteirinha/${acao}/${a.id}`);
      toast.success(acao === 'gerar' ? 'Carteirinha gerada!' : 'Carteirinha renovada!');
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar carteirinha');
    } finally { setGerandoCarteirinhaId(null); }
  }

  async function handleEnviarCarteirinha(a) {
    setEnviandoCarteirinhaId(a.id);
    try {
      await enviarCarteirinhaWhatsapp(a);
    } catch {
      toast.error('Erro ao montar a mensagem da carteirinha');
    } finally { setEnviandoCarteirinhaId(null); }
  }

  async function abrirDetalhe(id) {
    setCarregandoDetalhe(true);
    setModalDetalhe({ id });
    try {
      const res = await api.get(`/sindicato-associados/${id}`);
      setModalDetalhe(res.data);
    } catch {
      toast.error('Erro ao carregar detalhes');
      setModalDetalhe(null);
    } finally { setCarregandoDetalhe(false); }
  }

  async function toggleStatus(a) {
    try {
      await api.put(`/sindicato-associados/${a.id}/status`, { ativo: !a.ativo });
      toast.success(a.ativo ? 'Associado desativado.' : 'Associado reativado.');
      load(page); loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar status');
    }
  }

  function openEnviarUnico(associado) {
    setModalEnviar(associado);
    setTemplateEnviarId(templates[0]?.id || null);
  }

  async function handleEnviarUnico() {
    if (!templateEnviarId || !modalEnviar) return;
    setEnviando(true);
    try {
      const res = await api.post('/sindicato-beneficios/enviar', {
        associado_id: modalEnviar.id, template_id: templateEnviarId,
      });
      window.open(res.data.whatsapp_link, '_blank');
      toast.success('Mensagem gerada!');
      setModalEnviar(null);
      setModalDetalhe(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar mensagem');
    } finally { setEnviando(false); }
  }

  async function abrirMassa() {
    setModalMassa(true);
    setSelecionados(new Set());
    setFilaLinks(null);
    setFilaIndex(0);
    setTemplateMassaId(templates[0]?.id || null);
    setLoadingMassa(true);
    try {
      const res = await api.get('/sindicato-associados', {
        params: {
          page: 1, limit: 500,
          search: search || undefined, categoria: categoria || undefined,
          status: 'ativo', whatsapp: 'com',
        },
      });
      setAssociadosMassa(res.data.data);
    } catch { toast.error('Erro ao carregar associados'); }
    finally { setLoadingMassa(false); }
  }

  function toggleSelecionado(id) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados(prev => prev.size === associadosMassa.length ? new Set() : new Set(associadosMassa.map(a => a.id)));
  }

  async function iniciarEnvioMassa() {
    if (selecionados.size === 0 || !templateMassaId) return;
    setIniciandoMassa(true);
    try {
      const res = await api.post('/sindicato-beneficios/enviar-massa', {
        associado_ids: [...selecionados],
        template_id: templateMassaId,
      });
      setFilaLinks(res.data.links);
      setFilaIndex(0);
      if (res.data.erros?.length) {
        toast.error(`${res.data.erros.length} associado(s) não puderam ser incluídos`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar envio em massa');
    } finally { setIniciandoMassa(false); }
  }

  function abrirLinkAtual() {
    if (!filaLinks?.[filaIndex]) return;
    window.open(filaLinks[filaIndex].whatsapp_link, '_blank');
  }

  function fecharMassa() {
    setModalMassa(false);
    load(page); loadStats();
  }

  function setDependente(idx, campo, valor) {
    setForm(f => {
      const dependentes = [...f.dependentes];
      dependentes[idx] = { ...dependentes[idx], [campo]: valor };
      return { ...f, dependentes };
    });
  }

  function addDependente() {
    setForm(f => f.dependentes.length >= 6 ? f : { ...f, dependentes: [...f.dependentes, { ...DEPENDENTE_VAZIO }] });
  }

  function removeDependente(idx) {
    setForm(f => ({ ...f, dependentes: f.dependentes.filter((_, i) => i !== idx) }));
  }

  async function handleUploadFotoDependente(idx, file) {
    const dep = form.dependentes[idx];
    if (!dep?.id || !file) return;
    setEnviandoFotoDependenteIdx(idx);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const res = await api.put(`/sindicato-associados/dependente/${dep.id}/foto`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDependente(idx, 'foto_url', res.data.foto_url);
      toast.success('Foto do dependente atualizada!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar foto');
    } finally { setEnviandoFotoDependenteIdx(null); }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const podeSalvar = form.nome_completo.trim() && form.cpf.replace(/\D/g, '').length === 11;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Contact className="w-6 h-6 text-[#0C2D48]" />
            Associados
          </h1>
          <p className="text-slate-500 text-sm mt-1">Base de associados do SECI — cadastro, WhatsApp e envio de benefícios.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirMassa}
            className="flex items-center gap-2 whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            <Users2 className="w-4 h-4" /> Enviar Benefícios em Massa
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> Novo Associado
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-slate-500 text-xs font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.total ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs font-medium">Ativos</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.ativos ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs font-medium">Com WhatsApp</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.com_wpp ?? '—'}</p>
        </div>
        <button
          onClick={() => setWhatsappFiltro(whatsappFiltro === 'sem' ? '' : 'sem')}
          className={`card text-left transition-all ${whatsappFiltro === 'sem' ? 'ring-2 ring-amber-400 bg-amber-50' : 'hover:bg-amber-50/50'}`}
        >
          <p className="text-amber-700 text-xs font-medium">⚠ Sem WhatsApp</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.sem_wpp ?? '—'}</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar por nome, CPF ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
        <select className="input w-auto" value={whatsappFiltro} onChange={e => setWhatsappFiltro(e.target.value)}>
          <option value="">WhatsApp: todos</option>
          <option value="com">Com WhatsApp</option>
          <option value="sem">Sem WhatsApp</option>
        </select>
        {whatsappFiltro === 'sem' && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            Priorizando quem está sem WhatsApp
            <button onClick={() => setWhatsappFiltro('')}><X className="w-3 h-3" /></button>
          </span>
        )}
      </div>

      {/* Tabela */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Nome', 'CPF', 'Categoria', 'Celular', 'WhatsApp', 'Cidade', 'Carteirinha', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : associados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Nenhum associado encontrado</td></tr>
              ) : associados.map(a => (
                <tr key={a.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!a.ativo ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4">
                    <button onClick={() => abrirDetalhe(a.id)} className="text-slate-900 font-medium hover:text-[#0C2D48] hover:underline text-left">
                      {a.nome_completo}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{a.cpf}</td>
                  <td className="py-3 px-4 text-slate-600">{a.categoria_profissional || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{a.celular || '—'}</td>
                  <td className="py-3 px-4">
                    {a.whatsapp ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{a.whatsapp}</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Sem WhatsApp</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{a.cidade || '—'}</td>
                  <td className="py-3 px-4">
                    {(() => { const b = carteirinhaBadge(a); return (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.cls}`}>{b.label}</span>
                    ); })()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <a
                        href={a.whatsapp ? linkWhatsapp(a.whatsapp) : undefined}
                        target="_blank" rel="noreferrer"
                        onClick={e => { if (!a.whatsapp) e.preventDefault(); }}
                        title={a.whatsapp ? 'Abrir WhatsApp' : 'Sem WhatsApp cadastrado'}
                        className={`p-1.5 rounded-lg transition-colors ${a.whatsapp ? 'text-white bg-emerald-500 hover:bg-emerald-600' : 'text-slate-300 bg-slate-100 cursor-not-allowed'}`}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleEnviarCarteirinha(a)}
                        disabled={enviandoCarteirinhaId === a.id}
                        className="p-1.5 rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#0C2D48' }}
                        title="Enviar carteirinha"
                      >
                        {enviandoCarteirinhaId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleGerarRenovar(a)}
                        disabled={gerandoCarteirinhaId === a.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                        title={a.carteirinha_hash ? 'Renovar carteirinha' : 'Gerar carteirinha'}
                      >
                        {gerandoCarteirinhaId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={a.carteirinha_hash ? publicCarteirinhaUrl(a.carteirinha_hash) : undefined}
                        target="_blank" rel="noreferrer"
                        onClick={e => { if (!a.carteirinha_hash) e.preventDefault(); }}
                        title={a.carteirinha_hash ? 'Ver carteirinha' : 'Gere a carteirinha primeiro'}
                        className={`p-1.5 rounded-lg transition-colors ${a.carteirinha_hash ? 'text-slate-400 hover:bg-blue-50 hover:text-blue-600' : 'text-slate-300 cursor-not-allowed'}`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => openEdit(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleStatus(a)} className={`p-1.5 rounded-lg transition-colors ${a.ativo ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`} title={a.ativo ? 'Desativar' : 'Reativar'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">{total} associado(s) — página {page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: novo/editar associado */}
      <Modal open={!!modalForm} onClose={() => setModalForm(null)} title={modalForm === 'create' ? 'Novo Associado' : 'Editar Associado'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome Completo</label>
              <input className="input" value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">CPF</label>
              <input className="input" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="label">Data de Nascimento</label>
              <input type="date" className="input" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Sexo</label>
              <div className="flex gap-3 pt-2">
                {[['F', 'Feminino'], ['M', 'Masculino'], ['P', 'Prefere não informar']].map(([v, lbl]) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="radio" name="sexo" checked={form.sexo === v} onChange={() => setForm(f => ({ ...f, sexo: v }))} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Categoria Profissional</label>
              <select className="input" value={form.categoria_profissional} onChange={e => setForm(f => ({ ...f, categoria_profissional: e.target.value }))}>
                <option value="">—</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Código do Filiado</label>
              <input className="input" value={form.codigo_filiado} onChange={e => setForm(f => ({ ...f, codigo_filiado: e.target.value }))} />
            </div>
            <div>
              <label className="label">Celular</label>
              <input className="input" value={form.celular} onChange={e => setForm(f => ({ ...f, celular: maskPhone(e.target.value) }))} placeholder="(64) 99999-8888" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))} placeholder="(64) 99999-8888" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Cidade</label>
              <input className="input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="label">Estado</label>
              <input className="input" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} placeholder="GO" />
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>

          {modalForm === 'edit' && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">Empresa</label>
                  <button
                    type="button"
                    onClick={() => {
                      setEmpresaModoLivre(m => !m);
                      setForm(f => ({ ...f, empresa_id: null, empresa_nome_livre: '' }));
                      setEmpresaLabelAtual(''); setEmpresaBusca(''); setEmpresaOpcoes([]);
                    }}
                    className="text-xs font-semibold text-[#0C2D48] hover:underline"
                  >
                    {empresaModoLivre ? 'Buscar empresa cadastrada' : 'Outra (digitar)'}
                  </button>
                </div>
                {empresaModoLivre ? (
                  <input
                    className="input mt-1" placeholder="Nome da empresa"
                    value={form.empresa_nome_livre}
                    onChange={e => setForm(f => ({ ...f, empresa_nome_livre: e.target.value }))}
                  />
                ) : form.empresa_id ? (
                  <div className="flex items-center justify-between input mt-1">
                    <span className="text-slate-700 text-sm">{empresaLabelAtual}</span>
                    <button type="button" onClick={() => { setForm(f => ({ ...f, empresa_id: null })); setEmpresaLabelAtual(''); }} className="text-xs text-red-500 hover:text-red-700">remover</button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input className="input" placeholder="Buscar empresa..." value={empresaBusca} onChange={e => setEmpresaBusca(e.target.value)} />
                    {empresaOpcoes.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                        {empresaOpcoes.map(e => (
                          <button
                            key={e.id} type="button"
                            onClick={() => { setForm(f => ({ ...f, empresa_id: e.id })); setEmpresaLabelAtual(e.nome_fantasia || e.razao_social); setEmpresaBusca(''); setEmpresaOpcoes([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                          >
                            {e.nome_fantasia || e.razao_social}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="label">Foto</label>
                <div className="flex items-center gap-3">
                  {fotoPreview || fotoAtualUrl ? (
                    <img src={fotoPreview || assetUrl(fotoAtualUrl)} alt="" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                  <label className="btn-secondary cursor-pointer text-sm">
                    Escolher arquivo
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFotoChange} />
                  </label>
                </div>
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.dependentes_gerar_carteirinha}
                    onChange={e => setForm(f => ({ ...f, dependentes_gerar_carteirinha: e.target.checked }))}
                  />
                  Gerar carteirinha para dependentes também
                </label>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Dependentes</label>
              {form.dependentes.length < 6 && (
                <button onClick={addDependente} className="text-xs font-semibold text-[#0C2D48] hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              )}
            </div>
            <div className="space-y-2 mt-2">
              {form.dependentes.map((dep, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {dep.foto_url ? (
                    <img src={assetUrl(dep.foto_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: corAvatar(dep.nome) }}
                    >
                      {iniciais(dep.nome)}
                    </div>
                  )}
                  <input className="input flex-1" value={dep.nome} onChange={e => setDependente(idx, 'nome', e.target.value)} placeholder={`Nome do dependente ${idx + 1}`} />
                  <select className="input w-36" value={dep.grau} onChange={e => setDependente(idx, 'grau', e.target.value)}>
                    <option value="">Grau</option>
                    {GRAUS_DEPENDENTE.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                  </select>
                  <input type="date" className="input w-40" value={dep.data_nascimento} onChange={e => setDependente(idx, 'data_nascimento', e.target.value)} />
                  {dep.id && (
                    <label
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer flex-shrink-0"
                      title="Upload foto"
                    >
                      {enviandoFotoDependenteIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      <input
                        type="file" accept="image/png,image/jpeg" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFotoDependente(idx, f); }}
                      />
                    </label>
                  )}
                  <button onClick={() => removeDependente(idx)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {form.dependentes.length === 0 && <p className="text-xs text-slate-400">Nenhum dependente adicionado.</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalForm(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !podeSalvar} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: detalhes do associado */}
      <Modal open={!!modalDetalhe} onClose={() => setModalDetalhe(null)} title={modalDetalhe?.nome_completo || 'Detalhes do Associado'} maxWidth="max-w-xl">
        {carregandoDetalhe || !modalDetalhe?.cpf ? (
          <div className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><span className="text-slate-400">CPF:</span> <span className="text-slate-800">{modalDetalhe.cpf}</span></div>
              <div><span className="text-slate-400">Nascimento:</span> <span className="text-slate-800">{fmtData(modalDetalhe.data_nascimento)}</span></div>
              <div><span className="text-slate-400">Categoria:</span> <span className="text-slate-800">{modalDetalhe.categoria_profissional || '—'}</span></div>
              <div><span className="text-slate-400">Código Filiado:</span> <span className="text-slate-800">{modalDetalhe.codigo_filiado || '—'}</span></div>
              <div><span className="text-slate-400">Celular:</span> <span className="text-slate-800">{modalDetalhe.celular || '—'}</span></div>
              <div><span className="text-slate-400">WhatsApp:</span> <span className="text-slate-800">{modalDetalhe.whatsapp || 'Não cadastrado'}</span></div>
              <div><span className="text-slate-400">Email:</span> <span className="text-slate-800">{modalDetalhe.email || '—'}</span></div>
              <div><span className="text-slate-400">Cidade/UF:</span> <span className="text-slate-800">{[modalDetalhe.cidade, modalDetalhe.estado].filter(Boolean).join('/') || '—'}</span></div>
              <div><span className="text-slate-400">Status:</span> <span className={modalDetalhe.ativo ? 'text-emerald-600' : 'text-red-500'}>{modalDetalhe.ativo ? 'Ativo' : 'Inativo'}</span></div>
              <div><span className="text-slate-400">Empresa:</span> <span className="text-slate-800">{modalDetalhe.empresa_nome || modalDetalhe.empresa_nome_livre || '—'}</span></div>
              <div>
                <span className="text-slate-400">Carteirinha:</span>{' '}
                {(() => { const b = carteirinhaBadge(modalDetalhe); return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>; })()}
              </div>
            </div>

            {modalDetalhe.observacoes && (
              <div>
                <p className="text-slate-400 text-xs font-medium mb-1">Observações</p>
                <p className="text-slate-700 text-sm bg-slate-50 rounded-xl p-3">{modalDetalhe.observacoes}</p>
              </div>
            )}

            <div>
              <p className="text-slate-400 text-xs font-medium mb-1">Dependentes ({modalDetalhe.dependentes?.length || 0})</p>
              {modalDetalhe.dependentes?.length ? (
                <ul className="text-sm text-slate-700 space-y-1">
                  {modalDetalhe.dependentes.map(d => (
                    <li key={d.id} className="flex items-center gap-2">
                      • {d.nome}{d.grau ? ` (${GRAUS_DEPENDENTE.find(([v]) => v === d.grau)?.[1] || d.grau})` : ''}
                      {d.carteirinha_hash && (
                        <a href={publicCarteirinhaUrl(d.carteirinha_hash)} target="_blank" rel="noreferrer" className="text-[#0C2D48] hover:underline text-xs">
                          ver carteirinha
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-slate-400">Nenhum dependente cadastrado.</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => { setModalDetalhe(null); openEdit(modalDetalhe.id); }} className="btn-secondary flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Editar
              </button>
              {modalDetalhe.carteirinha_hash && (
                <a href={publicCarteirinhaUrl(modalDetalhe.carteirinha_hash)} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
                  <QrCode className="w-4 h-4" /> Ver Carteirinha
                </a>
              )}
              <button onClick={() => openEnviarUnico(modalDetalhe)} className="btn-primary flex items-center gap-2">
                <Send className="w-4 h-4" /> Enviar Benefícios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: enviar benefícios individual */}
      <Modal open={!!modalEnviar} onClose={() => setModalEnviar(null)} title={`Enviar Benefícios — ${modalEnviar?.nome_completo || ''}`}>
        <div className="space-y-4">
          {!modalEnviar?.whatsapp ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">Este associado não tem WhatsApp cadastrado. Edite o cadastro antes de enviar.</p>
          ) : (
            <div>
              <label className="label">Mensagem</label>
              <select className="input" value={templateEnviarId || ''} onChange={e => setTemplateEnviarId(Number(e.target.value))}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalEnviar(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleEnviarUnico} disabled={enviando || !templateEnviarId || !modalEnviar?.whatsapp} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: envio em massa */}
      <Modal open={modalMassa} onClose={fecharMassa} title="Enviar Benefícios em Massa" maxWidth="max-w-xl">
        {!filaLinks ? (
          <div className="space-y-4">
            <div>
              <label className="label">Mensagem</label>
              <select className="input" value={templateMassaId || ''} onChange={e => setTemplateMassaId(Number(e.target.value))}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">Lista considera os filtros de busca/categoria atuais e só inclui associados ativos com WhatsApp cadastrado.</p>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Associados ({selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'})</label>
              <button onClick={toggleTodos} className="text-xs font-semibold text-[#0C2D48] hover:underline">
                {selecionados.size === associadosMassa.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {loadingMassa ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
              ) : associadosMassa.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">Nenhum associado com WhatsApp para esses filtros</div>
              ) : associadosMassa.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggleSelecionado(a.id)}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  {selecionados.has(a.id) ? <CheckSquare className="w-4 h-4 text-[#0C2D48] flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  <span className="flex-1 text-slate-700">{a.nome_completo}</span>
                  <span className="text-xs text-slate-400">{a.whatsapp}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={fecharMassa} className="btn-secondary">Cancelar</button>
              <button
                onClick={iniciarEnvioMassa}
                disabled={iniciandoMassa || selecionados.size === 0 || !templateMassaId}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              >
                {iniciandoMassa && <Loader2 className="w-4 h-4 animate-spin" />}
                Iniciar Envio ({selecionados.size})
              </button>
            </div>
          </div>
        ) : filaIndex >= filaLinks.length ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-slate-700 font-semibold">Fila concluída! {filaLinks.length} mensagem(ns) geradas.</p>
            <button onClick={fecharMassa} className="btn-primary">Fechar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-500 text-sm">Enviando {filaIndex + 1} de {filaLinks.length}</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="font-bold text-slate-900">{filaLinks[filaIndex].nome}</p>
              <p className="text-slate-500 text-sm">{filaLinks[filaIndex].telefone}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={abrirLinkAtual} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200">
                <Send className="w-4 h-4" /> Abrir WhatsApp
              </button>
              <button onClick={() => setFilaIndex(i => i + 1)} className="btn-primary flex items-center gap-2">
                Próximo <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

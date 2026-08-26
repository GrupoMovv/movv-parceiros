import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import {
  Gift, Loader2, Search, Plus, Pencil, Trash2, Send, Users2,
  ChevronLeft, ChevronRight, CheckSquare, Square, ArrowRight,
} from 'lucide-react';

const EMPTY_FORM = { nome: '', whatsapp: '', empresa_id: null, empresa_label: '', observacoes: '' };
const LIMIT = 20;

function fmtUltimaMensagem(d) {
  if (!d) return 'Nunca';
  return d.slice(0, 10).split('-').reverse().join('/');
}

export default function SindicatoBeneficios() {
  const [colaboradores, setColaboradores] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [templates, setTemplates] = useState([]);

  const [modalColaborador, setModalColaborador] = useState(null); // 'create' | 'edit'
  const [modalColaboradorAlvo, setModalColaboradorAlvo] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [empresaBusca, setEmpresaBusca] = useState('');
  const [empresaOpcoes, setEmpresaOpcoes] = useState([]);

  const [modalDelete, setModalDelete] = useState(null);

  const [modalEnviar, setModalEnviar] = useState(null); // colaborador alvo
  const [templateEnviarId, setTemplateEnviarId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [modalMassa, setModalMassa] = useState(false);
  const [colaboradoresMassa, setColaboradoresMassa] = useState([]);
  const [loadingMassa, setLoadingMassa] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [templateMassaId, setTemplateMassaId] = useState(null);
  const [filaLinks, setFilaLinks] = useState(null);
  const [filaIndex, setFilaIndex] = useState(0);
  const [iniciandoMassa, setIniciandoMassa] = useState(false);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-beneficios/colaboradores', { params: { page: p, limit: LIMIT, search: s || undefined } });
      setColaboradores(res.data.data);
      setTotal(res.data.total);
    } catch { toast.error('Erro ao carregar colaboradores'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(1, search); setPage(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search]);
  useEffect(() => { load(page, search); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setEmpresaBusca('');
    setEmpresaOpcoes([]);
    setModalColaborador('create');
  }

  function openEdit(c) {
    setForm({ nome: c.nome, whatsapp: c.whatsapp, empresa_id: c.empresa_id, empresa_label: c.empresa_nome || '', observacoes: c.observacoes || '' });
    setEmpresaBusca('');
    setEmpresaOpcoes([]);
    setModalColaborador('edit');
    setModalColaboradorAlvo(c.id);
  }

  async function handleSaveColaborador() {
    setSaving(true);
    try {
      const payload = { nome: form.nome, whatsapp: form.whatsapp, empresa_id: form.empresa_id, observacoes: form.observacoes || null };
      if (modalColaborador === 'create') {
        await api.post('/sindicato-beneficios/colaboradores', payload);
        toast.success('Colaborador cadastrado!');
      } else {
        await api.put(`/sindicato-beneficios/colaboradores/${modalColaboradorAlvo}`, payload);
        toast.success('Colaborador atualizado!');
      }
      setModalColaborador(null);
      load(page, search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar colaborador');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    try {
      await api.delete(`/sindicato-beneficios/colaboradores/${modalDelete.id}`);
      toast.success('Colaborador removido.');
      setModalDelete(null);
      load(page, search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  }

  function openEnviar(c) {
    setModalEnviar(c);
    setTemplateEnviarId(templates[0]?.id || null);
  }

  async function handleEnviar() {
    if (!templateEnviarId) return;
    setEnviando(true);
    try {
      const res = await api.post('/sindicato-beneficios/enviar', { colaborador_id: modalEnviar.id, template_id: templateEnviarId });
      window.open(res.data.whatsapp_link, '_blank');
      toast.success('Mensagem gerada!');
      setModalEnviar(null);
      load(page, search);
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
      const res = await api.get('/sindicato-beneficios/colaboradores', { params: { page: 1, limit: 500 } });
      setColaboradoresMassa(res.data.data);
    } catch { toast.error('Erro ao carregar colaboradores'); }
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
    setSelecionados(prev => prev.size === colaboradoresMassa.length ? new Set() : new Set(colaboradoresMassa.map(c => c.id)));
  }

  async function iniciarEnvioMassa() {
    if (selecionados.size === 0 || !templateMassaId) return;
    setIniciandoMassa(true);
    try {
      const res = await api.post('/sindicato-beneficios/enviar-massa', {
        colaborador_ids: [...selecionados],
        template_id: templateMassaId,
      });
      setFilaLinks(res.data.links);
      setFilaIndex(0);
      if (res.data.erros?.length) {
        toast.error(`${res.data.erros.length} colaborador(es) não puderam ser incluídos`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar envio em massa');
    } finally { setIniciandoMassa(false); }
  }

  function abrirLinkAtual() {
    if (!filaLinks?.[filaIndex]) return;
    window.open(filaLinks[filaIndex].whatsapp_link, '_blank');
  }

  function proximoDaFila() {
    setFilaIndex(i => i + 1);
  }

  function fecharMassa() {
    setModalMassa(false);
    load(page, search);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const podeSalvarColaborador = form.nome.trim() && form.whatsapp.trim();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-[#0C2D48]" />
            Benefícios
          </h1>
          <p className="text-slate-500 text-sm mt-1">Divulgue o catálogo de benefícios do SECI via WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirMassa}
            className="flex items-center gap-2 whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            <Users2 className="w-4 h-4" /> Envio em Massa
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> Novo Colaborador
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="input pl-9" placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Nome', 'WhatsApp', 'Empresa', 'Última Mensagem', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : colaboradores.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Nenhum colaborador cadastrado</td></tr>
              ) : colaboradores.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-900 font-medium">{c.nome}</td>
                  <td className="py-3 px-4 text-slate-600">{c.whatsapp}</td>
                  <td className="py-3 px-4 text-slate-600">{c.empresa_nome || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{fmtUltimaMensagem(c.ultima_mensagem)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEnviar(c)} className="flex items-center gap-1 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg transition-colors">
                        <Send className="w-3.5 h-3.5" /> Enviar Benefícios
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModalDelete(c)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
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
            <span className="text-xs text-slate-400">{total} colaborador(es) — página {page} de {totalPages}</span>
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

      {/* Modal: novo/editar colaborador */}
      <Modal open={!!modalColaborador} onClose={() => setModalColaborador(null)} title={modalColaborador === 'create' ? 'Novo Colaborador' : 'Editar Colaborador'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="64999998888" />
          </div>
          <div>
            <label className="label">Empresa (opcional)</label>
            {form.empresa_id ? (
              <div className="flex items-center justify-between input">
                <span className="text-slate-700 text-sm">{form.empresa_label}</span>
                <button onClick={() => setForm(f => ({ ...f, empresa_id: null, empresa_label: '' }))} className="text-xs text-red-500 hover:text-red-700">remover</button>
              </div>
            ) : (
              <div className="relative">
                <input className="input" placeholder="Buscar empresa..." value={empresaBusca} onChange={e => setEmpresaBusca(e.target.value)} />
                {empresaOpcoes.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                    {empresaOpcoes.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setForm(f => ({ ...f, empresa_id: e.id, empresa_label: e.nome_fantasia || e.razao_social })); setEmpresaBusca(''); setEmpresaOpcoes([]); }}
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
          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalColaborador(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSaveColaborador} disabled={saving || !podeSalvarColaborador} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar remoção */}
      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <h2 className="font-bold text-slate-900 text-lg">Remover colaborador</h2>
              <p className="text-slate-600 text-sm mt-2">Remover <strong>{modalDelete.nome}</strong> da lista de benefícios?</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalDelete(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: enviar benefícios individual */}
      <Modal open={!!modalEnviar} onClose={() => setModalEnviar(null)} title={`Enviar Benefícios — ${modalEnviar?.nome || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Mensagem</label>
            <select className="input" value={templateEnviarId || ''} onChange={e => setTemplateEnviarId(Number(e.target.value))}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalEnviar(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleEnviar} disabled={enviando || !templateEnviarId} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: envio em massa */}
      <Modal open={modalMassa} onClose={fecharMassa} title="Envio em Massa" maxWidth="max-w-xl">
        {!filaLinks ? (
          <div className="space-y-4">
            <div>
              <label className="label">Mensagem</label>
              <select className="input" value={templateMassaId || ''} onChange={e => setTemplateMassaId(Number(e.target.value))}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Colaboradores ({selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'})</label>
              <button onClick={toggleTodos} className="text-xs font-semibold text-[#0C2D48] hover:underline">
                {selecionados.size === colaboradoresMassa.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {loadingMassa ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
              ) : colaboradoresMassa.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">Nenhum colaborador cadastrado</div>
              ) : colaboradoresMassa.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleSelecionado(c.id)}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  {selecionados.has(c.id) ? <CheckSquare className="w-4 h-4 text-[#0C2D48] flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  <span className="flex-1 text-slate-700">{c.nome}</span>
                  <span className="text-xs text-slate-400">{c.whatsapp}</span>
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
              <button onClick={proximoDaFila} className="btn-primary flex items-center gap-2">
                Próximo <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

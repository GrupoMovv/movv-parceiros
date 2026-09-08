import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Crown, Search, History, Video, FileText, Settings, X, Upload, Trash2, Pencil, Plus } from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';

const LIMIT = 20;

const PLANO_LABEL = { gratis: 'Grátis', oficial: 'Oficial', premium: 'Premium', master: 'Master' };
const PLANO_CLS = {
  gratis: 'bg-slate-100 text-slate-500',
  oficial: 'bg-amber-100 text-amber-700',
  premium: 'bg-amber-200 text-amber-800',
  master: 'bg-purple-100 text-purple-700',
};
const STATUS_CLS = {
  ativo: 'bg-emerald-100 text-emerald-700',
  suspenso: 'bg-red-100 text-red-700',
  cancelado: 'bg-slate-100 text-slate-500',
};
const MOTIVO_LABEL = { upgrade: 'Upgrade', downgrade: 'Downgrade', cancelamento: 'Cancelamento', ativacao_seed: 'Ativação seed', suspensao: 'Suspensão', reativacao: 'Reativação' };

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const ABAS = [
  { id: 'parceiros', label: 'Parceiros', Icone: Crown },
  { id: 'historico', label: 'Histórico', Icone: History },
  { id: 'lives', label: 'Lives', Icone: Video },
  { id: 'materiais', label: 'Materiais', Icone: FileText },
  { id: 'config', label: 'Configurações', Icone: Settings },
];

export default function SindicatoPlanos() {
  const [aba, setAba] = useState('parceiros');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Planos IUB MAIS</h1>
        <p className="text-slate-500 text-sm mt-1">Gestão de planos pagos dos parceiros do marketplace (Fase 2, ainda desligada — todo mundo é Grátis).</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              aba === a.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <a.Icone className="w-4 h-4" /> {a.label}
          </button>
        ))}
      </div>

      {aba === 'parceiros' && <AbaParceiros />}
      {aba === 'historico' && <AbaHistorico />}
      {aba === 'lives' && <AbaLives />}
      {aba === 'materiais' && <AbaMateriais />}
      {aba === 'config' && <AbaConfig />}
    </div>
  );
}

// ---------------------------------------------------------------- Parceiros

function AbaParceiros() {
  const [parceiros, setParceiros] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [planoFiltro, setPlanoFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (planoFiltro) params.plano = planoFiltro;
      if (busca) params.busca = busca;
      const res = await api.get('/sindicato-planos/parceiros', { params });
      setParceiros(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  }, [page, planoFiltro, busca]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca} onChange={e => { setBusca(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou slug..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>
        <select
          value={planoFiltro} onChange={e => { setPlanoFiltro(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
        >
          <option value="">Todos os planos</option>
          {Object.entries(PLANO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Parceiro</th>
              <th className="text-left px-4 py-2.5">Plano</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Expira em</th>
              <th className="text-right px-4 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Carregando...</td></tr>
            ) : parceiros.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum parceiro encontrado.</td></tr>
            ) : parceiros.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-slate-800">{p.nome}</p>
                  <p className="text-xs text-slate-400">{p.slug}</p>
                </td>
                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLANO_CLS[p.plano]}`}>{PLANO_LABEL[p.plano]}</span></td>
                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[p.plano_status]}`}>{p.plano_status}</span></td>
                <td className="px-4 py-2.5 text-slate-500">{fmtData(p.plano_expira_em)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => setEditando(p)} className="text-purple-600 hover:underline text-xs font-semibold">Gerenciar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-30">← Anterior</button>
          <span>Página {page} de {Math.ceil(total / LIMIT)}</span>
          <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-30">Próxima →</button>
        </div>
      )}

      {editando && <ModalGerenciarParceiro parceiro={editando} onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalGerenciarParceiro({ parceiro, onClose, onSalvo }) {
  const [planoNovo, setPlanoNovo] = useState(parceiro.plano);
  const [motivo, setMotivo] = useState('upgrade');
  const [observacoes, setObservacoes] = useState('');
  const [expiraEm, setExpiraEm] = useState(parceiro.plano_expira_em ? parceiro.plano_expira_em.slice(0, 10) : '');
  const [instagram, setInstagram] = useState(parceiro.instagram_username || '');
  const [salvando, setSalvando] = useState(false);
  const [enviandoBanner, setEnviandoBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(parceiro.banner_personalizado_url);

  async function salvarPlano() {
    if (planoNovo === parceiro.plano) return toast.error('Selecione um plano diferente do atual pra registrar a troca');
    setSalvando(true);
    try {
      await api.patch(`/sindicato-planos/parceiros/${parceiro.id}/plano`, {
        plano_novo: planoNovo, motivo, observacoes, plano_expira_em: expiraEm || null,
      });
      toast.success('Plano alterado!');
      onSalvo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar plano');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarPerfil() {
    try {
      await api.patch(`/sindicato-planos/parceiros/${parceiro.id}/perfil-plano`, { instagram_username: instagram });
      toast.success('Instagram salvo!');
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  async function toggleStatus() {
    const novo = parceiro.plano_status === 'suspenso' ? 'ativo' : 'suspenso';
    try {
      await api.patch(`/sindicato-planos/parceiros/${parceiro.id}/status`, { status: novo, motivo: `Alterado via painel admin` });
      toast.success(novo === 'suspenso' ? 'Plano suspenso' : 'Plano reativado');
      onSalvo();
    } catch {
      toast.error('Erro ao alterar status');
    }
  }

  async function handleBanner(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoBanner(true);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      const res = await api.post(`/sindicato-planos/parceiros/${parceiro.id}/banner`, fd);
      setBannerUrl(res.data.banner_personalizado_url);
      toast.success('Banner enviado!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar banner');
    } finally {
      setEnviandoBanner(false);
    }
  }

  async function removerBanner() {
    try {
      await api.delete(`/sindicato-planos/parceiros/${parceiro.id}/banner`);
      setBannerUrl(null);
      toast.success('Banner removido');
    } catch {
      toast.error('Erro ao remover banner');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Gerenciar plano — ${parceiro.nome}`} maxWidth="max-w-xl">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Trocar plano</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Novo plano</label>
              <select value={planoNovo} onChange={e => setPlanoNovo(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                {Object.entries(PLANO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Motivo</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                <option value="upgrade">Upgrade</option>
                <option value="downgrade">Downgrade</option>
                <option value="cancelamento">Cancelamento</option>
                <option value="ativacao_seed">Ativação seed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Expira em (opcional)</label>
              <input type="date" value={expiraEm} onChange={e => setExpiraEm(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500">Observações</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Ex: negociado por WhatsApp, pagou 3 meses..." />
            </div>
          </div>
          <button
            type="button" onClick={salvarPlano} disabled={salvando}
            className="mt-3 w-full text-sm font-bold py-2.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Confirmar troca de plano'}
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status do plano</p>
            <p className="text-sm text-slate-600 mt-0.5">Atual: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[parceiro.plano_status]}`}>{parceiro.plano_status}</span></p>
          </div>
          <button
            type="button" onClick={toggleStatus}
            className={`text-xs font-bold px-3 py-2 rounded-lg ${parceiro.plano_status === 'suspenso' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
          >
            {parceiro.plano_status === 'suspenso' ? 'Reativar' : 'Suspender'}
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Instagram (Premium/Master)</p>
          <div className="flex gap-2">
            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="usuario_do_instagram" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            <button type="button" onClick={salvarPerfil} className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50">Salvar</button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Banner personalizado (Master, 1200x300)</p>
          {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> {enviandoBanner ? 'Enviando...' : 'Enviar imagem'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBanner} disabled={enviandoBanner} />
            </label>
            {bannerUrl && (
              <button type="button" onClick={removerBanner} className="px-3 py-2 text-xs font-bold rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Histórico

function AbaHistorico() {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sindicato-planos/historico')
      .then(res => setHistorico(res.data.data))
      .catch(() => toast.error('Erro ao carregar histórico'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-slate-400 py-8">Carregando...</p>;
  if (historico.length === 0) return <p className="text-center text-slate-400 py-8">Nenhuma troca de plano registrada ainda.</p>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2.5">Parceiro</th>
            <th className="text-left px-4 py-2.5">Mudança</th>
            <th className="text-left px-4 py-2.5">Motivo</th>
            <th className="text-left px-4 py-2.5">Quem</th>
            <th className="text-left px-4 py-2.5">Quando</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {historico.map(h => (
            <tr key={h.id}>
              <td className="px-4 py-2.5 font-semibold text-slate-800">{h.parceiro_nome}</td>
              <td className="px-4 py-2.5">
                <span className={`px-1.5 py-0.5 rounded text-xs ${PLANO_CLS[h.plano_anterior] || 'bg-slate-100'}`}>{PLANO_LABEL[h.plano_anterior] || h.plano_anterior}</span>
                {' → '}
                <span className={`px-1.5 py-0.5 rounded text-xs ${PLANO_CLS[h.plano_novo] || 'bg-slate-100'}`}>{PLANO_LABEL[h.plano_novo] || h.plano_novo}</span>
              </td>
              <td className="px-4 py-2.5 text-slate-500">{MOTIVO_LABEL[h.motivo] || h.motivo}</td>
              <td className="px-4 py-2.5 text-slate-500">{h.alterado_por}</td>
              <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(h.alterado_em).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------------- Lives

const LIVE_VAZIA = { titulo: '', descricao: '', video_url: '', data_gravacao: '', duracao_minutos: '', ativo: true };

function AbaLives() {
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const carregar = useCallback(() => {
    api.get('/sindicato-planos/lives').then(res => setLives(res.data.lives)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    try {
      if (form.id) await api.put(`/sindicato-planos/lives/${form.id}`, form);
      else await api.post('/sindicato-planos/lives', form);
      toast.success('Live salva!');
      setForm(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar live');
    }
  }

  async function remover(id) {
    await api.delete(`/sindicato-planos/lives/${id}`);
    toast.success('Live removida');
    carregar();
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setForm(LIVE_VAZIA)} className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700">
        <Plus className="w-4 h-4" /> Nova live
      </button>

      {loading ? <p className="text-slate-400 text-sm">Carregando...</p> : lives.length === 0 ? (
        <p className="text-slate-400 text-sm py-6 text-center">Nenhuma live cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lives.map(l => (
            <div key={l.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-sm text-slate-800">{l.titulo}</p>
                {!l.ativo && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">inativa</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1">{l.data_gravacao ? fmtData(l.data_gravacao) : 'sem data'} {l.duracao_minutos ? `· ${l.duracao_minutos}min` : ''}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setForm({ ...l, data_gravacao: l.data_gravacao?.slice(0, 10) || '' })} className="flex items-center gap-1 text-xs font-semibold text-purple-600"><Pencil className="w-3 h-3" /> Editar</button>
                <button type="button" onClick={() => remover(l.id)} className="flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="w-3 h-3" /> Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? 'Editar live' : 'Nova live'}>
          <div className="space-y-3">
            <Campo label="Título"><input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <Campo label="Descrição"><textarea value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <Campo label="Link do vídeo (Youtube/Vimeo)"><input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data"><input type="date" value={form.data_gravacao || ''} onChange={e => setForm(f => ({ ...f, data_gravacao: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
              <Campo label="Duração (min)"><input type="number" value={form.duracao_minutos || ''} onChange={e => setForm(f => ({ ...f, duracao_minutos: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /> Ativa (visível pros Master)</label>
            <button type="button" onClick={salvar} className="w-full text-sm font-bold py-2.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700">Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Materiais

const MATERIAL_VAZIO = { titulo: '', descricao: '', tipo: 'pdf', categoria: 'marketing', url_conteudo: '', ativo: true };

function AbaMateriais() {
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const carregar = useCallback(() => {
    api.get('/sindicato-planos/materiais').then(res => setMateriais(res.data.materiais)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    try {
      if (form.id) await api.put(`/sindicato-planos/materiais/${form.id}`, form);
      else await api.post('/sindicato-planos/materiais', form);
      toast.success('Material salvo!');
      setForm(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar material');
    }
  }

  async function remover(id) {
    await api.delete(`/sindicato-planos/materiais/${id}`);
    toast.success('Material removido');
    carregar();
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setForm(MATERIAL_VAZIO)} className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700">
        <Plus className="w-4 h-4" /> Novo material
      </button>

      {loading ? <p className="text-slate-400 text-sm">Carregando...</p> : materiais.length === 0 ? (
        <p className="text-slate-400 text-sm py-6 text-center">Nenhum material cadastrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {materiais.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-sm text-slate-800">{m.titulo}</p>
                {!m.ativo && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">inativo</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1 capitalize">{m.tipo} · {m.categoria}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setForm(m)} className="flex items-center gap-1 text-xs font-semibold text-purple-600"><Pencil className="w-3 h-3" /> Editar</button>
                <button type="button" onClick={() => remover(m.id)} className="flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="w-3 h-3" /> Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? 'Editar material' : 'Novo material'}>
          <div className="space-y-3">
            <Campo label="Título"><input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <Campo label="Descrição"><textarea value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo">
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  <option value="video">Vídeo</option><option value="pdf">PDF</option><option value="template">Template</option><option value="ebook">E-book</option>
                </select>
              </Campo>
              <Campo label="Categoria">
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  <option value="marketing">Marketing</option><option value="fotografia">Fotografia</option><option value="gestao">Gestão</option><option value="precos">Preços</option>
                </select>
              </Campo>
            </div>
            <Campo label="Link do conteúdo (Cloudinary, Drive, Youtube...)"><input value={form.url_conteudo} onChange={e => setForm(f => ({ ...f, url_conteudo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" /></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /> Ativo (visível pros Master)</label>
            <button type="button" onClick={salvar} className="w-full text-sm font-bold py-2.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700">Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- Config

function AbaConfig() {
  const [planos, setPlanos] = useState(null);

  useEffect(() => {
    api.get('/sindicato-planos/config').then(res => setPlanos(res.data.planos)).catch(() => toast.error('Erro ao carregar config'));
  }, []);

  if (!planos) return <p className="text-slate-400 text-sm py-8 text-center">Carregando...</p>;

  const campos = ['preco', 'max_produtos', 'max_produtos_rotativa', 'boost_busca', 'selo_nome', 'analytics_avancado', 'aparece_destaques_parceiros', 'push_notification', 'instagram_integrado', 'banner_personalizado', 'materiais_educativos', 'grupo_vip'];
  const CAMPO_LABEL = {
    preco: 'Preço/mês', max_produtos: 'Máx. produtos', max_produtos_rotativa: 'Produtos na vitrine rotativa', boost_busca: 'Boost na busca',
    selo_nome: 'Nome do selo', analytics_avancado: 'Analytics avançado', aparece_destaques_parceiros: 'Aparece em Destaques',
    push_notification: 'Push notification', instagram_integrado: 'Instagram integrado', banner_personalizado: 'Banner personalizado',
    materiais_educativos: 'Materiais exclusivos', grupo_vip: 'Grupo VIP / Lives',
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Limites e preços de verdade moram em <code className="bg-amber-100 px-1 rounded">backend/src/config/planos.js</code> — essa tela é só leitura, pra conferir o que está valendo sem abrir o código. Pra mudar um valor, edite o arquivo (e faça deploy).
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Benefício</th>
              {Object.keys(planos).map(p => <th key={p} className="text-left px-4 py-2.5">{PLANO_LABEL[p] || p}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campos.map(campo => (
              <tr key={campo}>
                <td className="px-4 py-2.5 font-medium text-slate-600">{CAMPO_LABEL[campo]}</td>
                {Object.keys(planos).map(p => (
                  <td key={p} className="px-4 py-2.5 text-slate-700">
                    {typeof planos[p][campo] === 'boolean'
                      ? (planos[p][campo] ? '✅' : <X className="w-3.5 h-3.5 text-slate-300" />)
                      : (planos[p][campo] ?? (campo === 'max_produtos' ? '∞' : '—'))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

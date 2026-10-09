import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronDown, Eye, EyeOff, RefreshCw, Plus, Trash2, Save, FileSignature, SlidersHorizontal } from 'lucide-react';
import api from '../../../services/api';
import { identidade, dataBR } from '../../universidade/identidade';

// Universidade — conteúdo e regras: publicar módulos, editar aulas, tópicos e
// perguntas, "mudança relevante", termo de adesão e configuração. Tudo fica
// registrado em admin_acoes no servidor.
export default function AdminUniversidadeConteudo() {
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);

  const carregar = () => api.get('/universidade/admin/conteudo').then(r => setDados(r.data)).catch(() => toast.error('Erro ao carregar o conteúdo'));
  useEffect(() => { carregar(); }, []);

  if (!dados) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/admin/universidade" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-movv-900"><ChevronLeft className="w-4 h-4" /> Universidade</Link>
      <h1 className="text-xl font-display font-semibold text-slate-900">Conteúdo e regras da Universidade</h1>

      <Config config={dados.config} onSalvo={c => setDados(d => ({ ...d, config: c }))} />
      <Termo documentos={dados.documentos} onMudou={carregar} />

      <div className="space-y-2">
        <h2 className="font-semibold text-slate-900">Módulos</h2>
        {dados.modulos.map(m => (
          <Modulo key={m.id} m={m} aberto={aberto === m.id} onAbrir={() => setAberto(a => (a === m.id ? null : m.id))} onMudou={carregar} />
        ))}
      </div>
    </div>
  );
}

function Config({ config, onSalvo }) {
  const [f, setF] = useState({ nota: Math.round(config.nota_minima * 100), validade: config.validade_meses, prazo: config.prazo_atualizacao_dias, trava: config.trava_portal });
  const [salvando, setSalvando] = useState(false);
  async function salvar(extra = {}) {
    setSalvando(true);
    try {
      const v = { ...f, ...extra };
      const r = await api.patch('/universidade/admin/config', { nota_minima: v.nota / 100, validade_meses: Number(v.validade), prazo_atualizacao_dias: Number(v.prazo), trava_portal: v.trava });
      setF(v); onSalvo(r.data); toast.success('Regras salvas');
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao salvar'); } finally { setSalvando(false); }
  }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3"><SlidersHorizontal className="w-4 h-4 text-movv-900" /><h2 className="font-semibold text-slate-900">Regras</h2></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="cfg-nota">Aprovação no quiz (%)</label><input id="cfg-nota" type="number" min="1" max="100" className="input" value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} /></div>
        <div><label className="label" htmlFor="cfg-validade">Validade do certificado (meses)</label><input id="cfg-validade" type="number" min="1" className="input" value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} /></div>
        <div><label className="label" htmlFor="cfg-prazo">Prazo para atualizar módulo (dias)</label><input id="cfg-prazo" type="number" min="1" className="input" value={f.prazo} onChange={e => setF({ ...f, prazo: e.target.value })} /></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-start gap-2 text-sm text-slate-700 max-w-xl">
          <input id="cfg-trava" type="checkbox" className="mt-0.5" checked={f.trava} onChange={e => salvar({ trava: e.target.checked })} disabled={salvando} />
          <span><strong>Trava do portal</strong>: Partner sem certificado válido só usa a Universidade e o próprio perfil. {f.trava ? 'Ligada.' : 'Desligada.'}</span>
        </label>
        <button onClick={() => salvar()} disabled={salvando} className="btn-primary">Salvar regras</button>
      </div>
    </div>
  );
}

function Termo({ documentos, onMudou }) {
  const termos = documentos.filter(d => d.documento === 'termo_adesao');
  const ultimo = termos[0];
  const publicado = termos.find(d => d.publicado);
  const [titulo, setTitulo] = useState(ultimo?.titulo || '');
  const [texto, setTexto] = useState(ultimo?.texto || '');
  const [aberto, setAberto] = useState(false);
  const [confirmar, setConfirmar] = useState(null);

  async function salvar() {
    try { await api.put('/universidade/admin/termo', { titulo, texto }); toast.success(ultimo?.publicado ? 'Versão nova criada (despublicada)' : 'Termo salvo'); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro ao salvar o termo'); }
  }
  async function publicar(d, valor) {
    try { await api.patch(`/universidade/admin/termo/${d.id}/publicar`, { publicado: valor }); toast.success(valor ? 'Termo publicado' : 'Termo despublicado'); setConfirmar(null); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }

  return (
    <div className="card">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2"><FileSignature className="w-4 h-4 text-movv-900" /><span className="font-semibold text-slate-900">Termo de adesão</span></span>
        <span className="flex items-center gap-2 text-sm">
          {publicado ? <span className="badge-converted">Publicado: versão {publicado.versao}</span> : <span className="badge-pending">Despublicado (revisão jurídica)</span>}
          <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {aberto && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Sem termo publicado, nenhum Partner passa do Módulo 0. Publicar uma versão nova pede o aceite de novo a todos.</p>
          <div className="space-y-1">
            {termos.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border border-slate-200 px-3 py-2">
                <span>Versão {d.versao} · {d.titulo}{d.publicado_em ? ` · publicada em ${dataBR(d.publicado_em)}` : ''}</span>
                {confirmar === d.id ? (
                  <span className="flex gap-1">
                    <button onClick={() => publicar(d, !d.publicado)} className="btn-primary !px-3 !py-1 text-xs">Confirmar</button>
                    <button onClick={() => setConfirmar(null)} className="btn-secondary !px-3 !py-1 text-xs">Cancelar</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmar(d.id)} className="btn-secondary !px-3 !py-1 text-xs">{d.publicado ? 'Despublicar' : 'Publicar'}</button>
                )}
              </div>
            ))}
          </div>
          <div><label className="label" htmlFor="termo-titulo">Título</label><input id="termo-titulo" className="input" value={titulo} onChange={e => setTitulo(e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="termo-texto">Texto (parágrafos separados por linha em branco; "## " para título de seção)</label>
            <textarea id="termo-texto" rows={12} className="input font-mono text-[13px]" value={texto} onChange={e => setTexto(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button onClick={salvar} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" /> {ultimo?.publicado ? 'Salvar como versão nova' : 'Salvar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Modulo({ m, aberto, onAbrir, onMudou }) {
  const { cor, icone: Icone } = identidade(m.numero);
  const [confirmar, setConfirmar] = useState(null); // 'publicar' | 'relevante'
  const [motivo, setMotivo] = useState('');
  const totalTopicos = m.aulas.reduce((s, a) => s + a.topicos.length, 0);

  async function publicar() {
    try { await api.patch(`/universidade/admin/modulos/${m.id}`, { publicado: !m.publicado }); toast.success(m.publicado ? 'Módulo despublicado' : 'Módulo publicado'); setConfirmar(null); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); setConfirmar(null); }
  }
  async function relevante() {
    try { await api.post(`/universidade/admin/modulos/${m.id}/mudanca-relevante`, { motivo }); toast.success('Mudança relevante registrada: o quiz volta a pendente'); setConfirmar(null); setMotivo(''); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cor }}><Icone className="w-4 h-4 text-white" /></div>
        <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-slate-900 leading-snug">Módulo {m.numero} · {m.titulo}</p>
          <p className="text-xs text-slate-500">{m.aulas.length} aulas · {totalTopicos} tópicos · {m.perguntas.length} perguntas · versão {m.versao_conteudo}{m.conteudo_pendente ? ' · conteúdo pendente' : ''}</p>
        </button>
        <span className={m.publicado ? 'badge-converted' : 'badge-pending'}>{m.publicado ? 'Publicado' : 'Despublicado'}</span>
        <ChevronDown onClick={onAbrir} className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </div>
      {aberto && (
        <div className="border-t border-slate-100 p-3 sm:p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {confirmar === 'publicar' ? (
              <>
                <span className="text-sm text-slate-700 self-center">{m.publicado ? 'Despublicar? Os Partners deixam de ver o módulo.' : 'Publicar? Os Partners passam a ver o módulo.'}</span>
                <button onClick={publicar} className="btn-primary !py-1.5">Confirmar</button>
                <button onClick={() => setConfirmar(null)} className="btn-secondary !py-1.5">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setConfirmar('publicar')} disabled={m.conteudo_pendente && !m.publicado} className="btn-secondary !py-1.5 inline-flex items-center gap-2 disabled:opacity-40">
                {m.publicado ? <><EyeOff className="w-4 h-4" /> Despublicar</> : <><Eye className="w-4 h-4" /> Publicar</>}
              </button>
            )}
            {confirmar !== 'publicar' && (
              <button onClick={() => setConfirmar(c => (c === 'relevante' ? null : 'relevante'))} className="btn-secondary !py-1.5 inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Mudança relevante
              </button>
            )}
          </div>
          {m.conteudo_pendente && <p className="text-sm text-amber-700">Conteúdo ainda não escrito: o módulo fica despublicado até entrar pela importação.</p>}
          {confirmar === 'relevante' && (
            <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 space-y-2 text-sm">
              <p className="text-orange-800">Depois de editar o conteúdo: todos os Partners precisam refazer o quiz deste módulo. Quem já é certificado mantém o certificado e tem o prazo de atualização para refazer.</p>
              <input id={`motivo-${m.id}`} className="input" placeholder="O que mudou (fica no registro)" value={motivo} onChange={e => setMotivo(e.target.value)} />
              <div className="flex gap-2"><button onClick={relevante} className="btn-primary !py-1.5">Confirmar mudança relevante</button><button onClick={() => setConfirmar(null)} className="btn-secondary !py-1.5">Cancelar</button></div>
            </div>
          )}
          {m.recertificar_desde && <p className="text-xs text-slate-500">Última mudança relevante: {dataBR(m.recertificar_desde)}.</p>}

          {m.aulas.map(a => <Aula key={a.id} a={a} onMudou={onMudou} />)}
          <NovaAula moduloId={m.id} onMudou={onMudou} />

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">Quiz ({m.perguntas.length} perguntas)</h3>
            {m.perguntas.map(p => <Pergunta key={p.id} p={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Aula({ a, onMudou }) {
  const [titulo, setTitulo] = useState(a.titulo);
  const [video, setVideo] = useState(a.video_url || '');
  const [apagar, setApagar] = useState(false);
  const [novo, setNovo] = useState(null);
  async function salvar() {
    try { await api.patch(`/universidade/admin/aulas/${a.id}`, { titulo, video_url: video }); toast.success('Aula salva'); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  async function excluir() {
    try { await api.delete(`/universidade/admin/aulas/${a.id}`); toast.success('Aula excluída'); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  async function criarTopico() {
    try { await api.post(`/universidade/admin/aulas/${a.id}/topicos`, novo); toast.success('Tópico criado'); setNovo(null); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)_auto] sm:items-center">
        <span className="text-xs font-bold text-slate-400 tabular-nums">Aula {a.ordem}</span>
        <input id={`aula-titulo-${a.id}`} className="input !py-1.5" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <input id={`aula-video-${a.id}`} className="input !py-1.5" placeholder="Link do vídeo (opcional)" value={video} onChange={e => setVideo(e.target.value)} />
        <div className="flex gap-1">
          <button onClick={salvar} title="Salvar aula" className="p-2 rounded-lg text-movv-900 hover:bg-slate-100"><Save className="w-4 h-4" /></button>
          {apagar
            ? <button onClick={excluir} className="px-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50">Excluir mesmo? (apaga as leituras dela)</button>
            : <button onClick={() => setApagar(true)} title="Excluir aula" className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>
      {a.topicos.map(t => <Topico key={t.id} t={t} onMudou={onMudou} />)}
      {novo ? (
        <div className="space-y-2 rounded-lg bg-slate-50 p-2">
          <input id={`novo-topico-titulo-${a.id}`} className="input !py-1.5" placeholder="Título do tópico" value={novo.titulo} onChange={e => setNovo({ ...novo, titulo: e.target.value })} />
          <textarea id={`novo-topico-texto-${a.id}`} rows={4} className="input text-[14px]" placeholder="Texto da apostila" value={novo.texto} onChange={e => setNovo({ ...novo, texto: e.target.value })} />
          <div className="flex gap-2"><button onClick={criarTopico} className="btn-primary !py-1.5">Criar tópico</button><button onClick={() => setNovo(null)} className="btn-secondary !py-1.5">Cancelar</button></div>
        </div>
      ) : (
        <button onClick={() => setNovo({ titulo: '', texto: '' })} className="text-sm text-movv-900 font-medium inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Tópico</button>
      )}
    </div>
  );
}

function Topico({ t, onMudou }) {
  const [titulo, setTitulo] = useState(t.titulo);
  const [texto, setTexto] = useState(t.texto);
  const [apagar, setApagar] = useState(false);
  const mudou = titulo !== t.titulo || texto !== t.texto;
  async function salvar() {
    try { const r = await api.patch(`/universidade/admin/topicos/${t.id}`, { titulo, texto }); t.titulo = r.data.titulo; t.texto = r.data.texto; toast.success('Tópico salvo'); setTitulo(r.data.titulo); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  async function excluir() {
    try { await api.delete(`/universidade/admin/topicos/${t.id}`); toast.success('Tópico excluído'); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  return (
    <div className="pl-2 sm:pl-4 border-l-2 border-slate-100 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 tabular-nums">{t.numero}.</span>
        <input id={`topico-titulo-${t.id}`} className="input !py-1 text-sm font-medium" value={titulo} onChange={e => setTitulo(e.target.value)} />
      </div>
      <textarea id={`topico-texto-${t.id}`} rows={4} className="input text-[14px] leading-relaxed" value={texto} onChange={e => setTexto(e.target.value)} />
      <div className="flex gap-2 items-center">
        <button onClick={salvar} disabled={!mudou} className="btn-primary !px-3 !py-1 text-xs disabled:opacity-40">Salvar tópico</button>
        {apagar
          ? <><button onClick={excluir} className="btn-danger !px-3 !py-1 text-xs">Excluir mesmo</button><button onClick={() => setApagar(false)} className="btn-secondary !px-3 !py-1 text-xs">Cancelar</button></>
          : <button onClick={() => setApagar(true)} className="text-xs text-red-500 hover:underline">Excluir</button>}
        {t.atualizado_em && <span className="text-[11px] text-slate-400 ml-auto">editado em {dataBR(t.atualizado_em)}</span>}
      </div>
    </div>
  );
}

function NovaAula({ moduloId, onMudou }) {
  const [titulo, setTitulo] = useState(null);
  async function criar() {
    try { await api.post(`/universidade/admin/modulos/${moduloId}/aulas`, { titulo }); toast.success('Aula criada'); setTitulo(null); onMudou(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  return titulo === null
    ? <button onClick={() => setTitulo('')} className="text-sm text-movv-900 font-medium inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Aula</button>
    : (
      <div className="flex gap-2">
        <input id={`nova-aula-${moduloId}`} className="input !py-1.5" placeholder="Título da aula nova" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <button onClick={criar} className="btn-primary !py-1.5">Criar</button>
        <button onClick={() => setTitulo(null)} className="btn-secondary !py-1.5">Cancelar</button>
      </div>
    );
}

function Pergunta({ p }) {
  const [f, setF] = useState({ enunciado: p.enunciado, alternativas: p.alternativas, correta: p.correta, explicacao: p.explicacao || '', ativa: p.ativa });
  const [salvo, setSalvo] = useState(f);
  const mudou = JSON.stringify(f) !== JSON.stringify(salvo);
  async function salvar() {
    try { await api.patch(`/universidade/admin/perguntas/${p.id}`, f); setSalvo(f); toast.success('Pergunta salva'); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${f.ativa ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs text-slate-400 tabular-nums pt-2">{p.numero}.</span>
        <textarea id={`perg-${p.id}`} rows={2} className="input !py-1.5 text-sm font-medium" value={f.enunciado} onChange={e => setF({ ...f, enunciado: e.target.value })} />
      </div>
      {f.alternativas.map(a => (
        <label key={a.id} className="flex items-center gap-2 pl-5">
          <input type="radio" name={`certa-${p.id}`} checked={f.correta === a.id} onChange={() => setF({ ...f, correta: a.id })} title="Resposta certa" />
          <input id={`alt-${a.id}`} className={`input !py-1 text-sm ${f.correta === a.id ? '!border-emerald-400 bg-emerald-50' : ''}`} value={a.texto}
            onChange={e => setF({ ...f, alternativas: f.alternativas.map(x => (x.id === a.id ? { ...x, texto: e.target.value } : x)) })} />
        </label>
      ))}
      <div className="pl-5 space-y-2">
        <textarea id={`expl-${p.id}`} rows={2} className="input !py-1.5 text-sm" placeholder="Explicação (aparece no resultado do quiz)" value={f.explicacao} onChange={e => setF({ ...f, explicacao: e.target.value })} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={f.ativa} onChange={e => setF({ ...f, ativa: e.target.checked })} /> Ativa</label>
          <span className="text-[11px] text-slate-400">A ordem das alternativas é embaralhada para o Partner; marque a certa no círculo.</span>
          <button onClick={salvar} disabled={!mudou} className="btn-primary !px-3 !py-1 text-xs ml-auto disabled:opacity-40">Salvar pergunta</button>
        </div>
      </div>
    </div>
  );
}

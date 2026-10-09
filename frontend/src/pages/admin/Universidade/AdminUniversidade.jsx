import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GraduationCap, Plus, Search, KeyRound, Edit2, Copy, BookOpen, Award } from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';
import { NIVEIS, SITUACAO, dataBR, pct } from '../../universidade/identidade';

// Universidade MOVV Partner — administração: cada Partner com módulo atual,
// % concluído, última atividade, notas e certificação; criar Partner e mandar
// o acesso por e-mail; editar e redefinir acesso. Admin e comercial_full.
const FORM_VAZIO = { name: '', email: '', whatsapp: '', nivel_partner: '', is_active: true };

export default function AdminUniversidade() {
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(null); // 'criar' | 'editar' | 'detalhe' | 'senha'
  const [form, setForm] = useState(FORM_VAZIO);
  const [selecionado, setSelecionado] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [senha, setSenha] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api.get('/universidade/admin/progresso').then(r => setDados(r.data)).catch(() => toast.error('Erro ao carregar a Universidade'));
  useEffect(() => { carregar(); }, []);

  function abrirCriar() { setForm(FORM_VAZIO); setSelecionado(null); setModal('criar'); }
  function abrirEditar(p) {
    setSelecionado(p);
    setForm({ name: p.name, email: p.email, whatsapp: p.whatsapp || '', nivel_partner: p.nivel_partner || '', is_active: p.is_active });
    setModal('editar');
  }
  async function abrirDetalhe(p) {
    setSelecionado(p); setDetalhe(null); setModal('detalhe');
    try { setDetalhe((await api.get(`/universidade/admin/partners/${p.id}`)).data); } catch { toast.error('Erro ao carregar o Partner'); }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const corpo = { ...form, nivel_partner: form.nivel_partner || null };
      if (modal === 'criar') {
        const r = await api.post('/universidade/admin/partners', corpo);
        setSenha({ ...r.data, nome: r.data.partner.name, codigo: r.data.partner.code });
        setModal('senha');
      } else {
        await api.put(`/universidade/admin/partners/${selecionado.id}`, corpo);
        toast.success('Partner atualizado');
        setModal(null);
      }
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  async function redefinir(p) {
    setSalvando(true);
    try {
      const r = await api.post(`/universidade/admin/partners/${p.id}/redefinir-acesso`);
      setSenha({ ...r.data, nome: p.name, codigo: p.code, redefinido: true });
      setModal('senha');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao redefinir o acesso');
    } finally { setSalvando(false); }
  }

  const lista = (dados?.partners || []).filter(p => {
    const q = busca.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-movv-900 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-gold-300" /></div>
          <div>
            <h1 className="text-xl font-display font-semibold text-slate-900">Universidade MOVV Partner</h1>
            <p className="text-sm text-slate-500">
              {dados ? `${dados.partners.length} Partner(s) · aprovação ${pct(dados.config.nota_minima)} · trava do portal ${dados.config.trava_portal ? 'ligada' : 'desligada'}` : 'Carregando…'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/admin/universidade/conteudo" className="btn-secondary inline-flex items-center gap-2"><BookOpen className="w-4 h-4" /> Conteúdo e regras</Link>
          <button onClick={abrirCriar} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Partner</button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input id="busca-partner" className="input pl-9" placeholder="Buscar por nome, código ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="px-3 py-3">Partner</th>
              <th className="px-3 py-3">Módulo atual</th>
              <th className="px-3 py-3">Concluído</th>
              <th className="px-3 py-3">Última atividade</th>
              <th className="px-3 py-3">Notas</th>
              <th className="px-3 py-3">Certificação</th>
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!dados && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Carregando…</td></tr>}
            {dados && !lista.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Nenhum Partner cadastrado ainda.</td></tr>}
            {lista.map(p => (
              <tr key={p.id} className="border-b border-slate-100 align-top">
                <td className="px-3 py-3 min-w-[170px]">
                  <button onClick={() => abrirDetalhe(p)} className="font-semibold text-slate-900 hover:underline text-left">{p.name}</button>
                  <p className="text-xs text-slate-500 font-mono">{p.code}{p.nivel_partner ? ` · ${NIVEIS[p.nivel_partner]}` : ''}</p>
                  {!p.is_active && <span className="badge-expired mt-1">Inativo</span>}
                  {p.must_change_password && <span className="badge-pending mt-1">Senha provisória</span>}
                </td>
                <td className="px-3 py-3 min-w-[150px]">
                  {p.modulo_atual
                    ? <><p className="text-slate-800">Módulo {p.modulo_atual.numero}</p><p className="text-xs text-slate-500">{SITUACAO[p.modulo_atual.situacao]?.rotulo}</p></>
                    : <span className={p.progresso_geral === 100 ? 'text-emerald-700' : 'text-slate-400'}>{p.progresso_geral === 100 ? 'Todos concluídos' : '—'}</span>}
                </td>
                <td className="px-3 py-3 min-w-[110px]">
                  <p className="font-semibold tabular-nums">{p.progresso_geral}%</p>
                  <div className="mt-1 h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-gold-500" style={{ width: `${p.progresso_geral}%` }} /></div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{dataBR(p.ultima_atividade)}</td>
                <td className="px-3 py-3 min-w-[150px]">
                  <div className="flex flex-wrap gap-1">
                    {p.notas.length ? p.notas.map(n => (
                      <span key={n.numero} title={`${n.tentativas} tentativa(s), melhor ${pct(n.melhor)}`}
                        className={`px-1.5 py-0.5 rounded text-[11px] tabular-nums border ${n.aprovado ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        M{n.numero} {pct(n.ultima)}
                      </span>
                    )) : <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-3 py-3 min-w-[140px]">
                  {p.certificado ? (
                    <>
                      <p className="font-mono text-xs">{p.certificado.codigo}</p>
                      <p className={`text-xs ${p.certificado_valido ? 'text-emerald-700' : 'text-orange-700'}`}>
                        {p.certificado.status === 'vencida' ? 'Vencido' : p.certificado.suspenso ? 'Suspenso' : `Válido até ${dataBR(p.certificado.valido_ate)}`}
                      </p>
                    </>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => abrirEditar(p)} title="Editar" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => redefinir(p)} disabled={salvando} title="Redefinir acesso (senha provisória nova por e-mail)" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><KeyRound className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal === 'criar' || modal === 'editar'} onClose={() => setModal(null)} title={modal === 'criar' ? 'Novo MOVV Partner' : 'Editar Partner'}>
        <div className="space-y-3">
          <div><label className="label" htmlFor="p-nome">Nome completo</label><input id="p-nome" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label" htmlFor="p-email">E-mail</label><input id="p-email" type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label" htmlFor="p-whats">WhatsApp</label><input id="p-whats" className="input" placeholder="(64) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
          <div>
            <label className="label" htmlFor="p-nivel">Nível</label>
            <select id="p-nivel" className="input" value={form.nivel_partner} onChange={e => setForm(f => ({ ...f, nivel_partner: e.target.value }))}>
              <option value="">A definir</option>
              {Object.entries(NIVEIS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          {modal === 'editar' && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input id="p-ativo" type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Acesso ativo
            </label>
          )}
          {modal === 'criar' && <p className="text-xs text-slate-500">O código (PARTNER-NNN) e a senha provisória são gerados aqui. O acesso vai por e-mail e a senha aparece uma vez na tela.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary">{salvando ? 'Salvando…' : modal === 'criar' ? 'Criar e enviar acesso' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'senha'} onClose={() => { setModal(null); setSenha(null); }} title={senha?.redefinido ? 'Acesso redefinido' : 'Partner criado'}>
        {senha && (
          <div className="space-y-3 text-sm">
            <p><strong>{senha.nome}</strong> · <span className="font-mono">{senha.codigo}</span></p>
            <div className="rounded-xl border border-gold-500/40 bg-gold-100 p-4">
              <p className="text-xs uppercase tracking-wider text-gold-900">Senha provisória (aparece só agora)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-xl font-bold tracking-widest text-movv-900 select-all">{senha.senha_provisoria}</code>
                <button onClick={() => navigator.clipboard?.writeText(senha.senha_provisoria).then(() => toast.success('Copiada')).catch(() => {})} className="p-1.5 rounded-lg hover:bg-white/60" title="Copiar"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <p className={senha.email === 'enviado' ? 'text-emerald-700' : 'text-orange-700'}>
              {senha.email === 'enviado' ? 'E-mail de acesso enviado.' : 'O e-mail não saiu. Repasse o código e a senha provisória por outro canal.'}
            </p>
            <p className="text-slate-500">No primeiro acesso o portal pede para trocar a senha.</p>
          </div>
        )}
      </Modal>

      <Modal open={modal === 'detalhe'} onClose={() => setModal(null)} title={selecionado?.name || 'Partner'} maxWidth="max-w-2xl">
        {!detalhe ? <p className="text-slate-400">Carregando…</p> : (
          <div className="space-y-5 text-sm">
            <p className="text-slate-600">{detalhe.partner.code} · {detalhe.partner.email} · {NIVEIS[detalhe.partner.nivel_partner] || 'nível a definir'} · {detalhe.progresso_geral}% concluído</p>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Módulos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {detalhe.modulos.filter(m => m.publicado).map(m => (
                  <div key={m.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="font-medium">Módulo {m.numero}</p>
                    <p className="text-xs text-slate-500">{SITUACAO[m.situacao]?.rotulo} · {m.aulas_lidas}/{m.aulas_total} aulas{m.melhor_nota !== null ? ` · melhor ${pct(m.melhor_nota)}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Aceites do termo</h3>
              {detalhe.aceites.length ? detalhe.aceites.map(a => (
                <p key={a.versao} className="text-slate-600">Versão {a.versao} · {new Date(a.aceito_em).toLocaleString('pt-BR')} · IP {a.ip || '—'}</p>
              )) : <p className="text-slate-400">Nenhum aceite.</p>}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Certificados</h3>
              {detalhe.certificados.length ? detalhe.certificados.map(c => (
                <p key={c.codigo} className="flex items-center gap-2 text-slate-600"><Award className="w-4 h-4 text-gold-700" /><span className="font-mono">{c.codigo}</span> · {dataBR(c.emitido_em)} a {dataBR(c.valido_ate)} · {c.status}</p>
              )) : <p className="text-slate-400">Nenhum certificado.</p>}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Tentativas de quiz ({detalhe.tentativas.length})</h3>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {detalhe.tentativas.map(t => (
                  <p key={t.id} className="py-1 text-slate-600 tabular-nums">
                    Módulo {t.numero} · {t.acertos}/{t.total} · <span className={t.aprovado ? 'text-emerald-700' : 'text-red-600'}>{t.aprovado ? 'aprovado' : 'reprovado'}</span> · {new Date(t.criado_em).toLocaleString('pt-BR')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

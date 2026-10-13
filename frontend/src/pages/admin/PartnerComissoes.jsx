import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Percent, Plus, Loader2, AlertTriangle, RefreshCw, CheckCircle2, Wallet, Undo2, X, Pencil } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  STATUS_LANC, ORIGEM, BASE, NIVEIS, centavos, reais, pct, competenciaBR, dataBR,
} from '../universidade/comissoesRotulos';
import { ImportacaoAzul, PendenciasAzul } from './PartnerComissoesImportacao';

// Livro de comissões do MOVV Partner — administração (migration 093).
// Admin e financeiro: lançamentos, aprovação, pagamento, estorno e avisos.
// Regras (percentuais por origem/produto × nível): só o admin completo edita.
export default function AdminPartnerComissoes() {
  const [aba, setAba] = useState('lancamentos');
  const [avisosAbertos, setAvisosAbertos] = useState(0);
  const [pendenciasAzul, setPendenciasAzul] = useState(0);
  const [versaoPendencias, setVersaoPendencias] = useState(0); // recarrega depois de importar
  const abas = [
    ['lancamentos', 'Lançamentos'],
    ['importacao', 'Importação Azul'],
    ['pendencias', `Pendências da importação${pendenciasAzul ? ` (${pendenciasAzul})` : ''}`],
    ['regras', 'Regras (tabela vigente)'],
    ['avisos', `Avisos${avisosAbertos ? ` (${avisosAbertos})` : ''}`],
  ];
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gold-gradient flex items-center justify-center"><Percent className="w-6 h-6 text-movv-900" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comissões do Partner</h1>
          <p className="text-slate-500 text-sm">Livro único de comissões do MOVV Partner</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {abas.map(([k, r]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap -mb-px border-b-2 ${aba === k ? 'border-movv-900 text-movv-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {r}
          </button>
        ))}
      </div>
      {aba === 'lancamentos' && <Lancamentos />}
      {aba === 'importacao' && <ImportacaoAzul onImportou={() => setVersaoPendencias(v => v + 1)} />}
      <div className={aba === 'pendencias' ? '' : 'hidden'}>
        <PendenciasAzul key={versaoPendencias} onContagem={setPendenciasAzul} />
      </div>
      {aba === 'regras' && <Regras />}
      <Avisos visivel={aba === 'avisos'} onContagem={setAvisosAbertos} />
    </div>
  );
}

// ─── Lançamentos ────────────────────────────────────────────────────────────

function Lancamentos() {
  const [filtros, setFiltros] = useState({ partner_id: '', competencia: '', status: '', origem: '' });
  const [lista, setLista] = useState([]);
  const [partners, setPartners] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState(new Set());
  const [modal, setModal] = useState(null); // { tipo: 'pagar'|'estornar'|'manual', ids? }
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      const r = await api.get('/partner-comissoes/admin/lancamentos', { params });
      setLista(r.data);
      setSelecionados(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao carregar lançamentos');
    } finally { setCarregando(false); }
  }, [filtros]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { api.get('/partner-comissoes/admin/partners').then(r => setPartners(r.data)).catch(() => {}); }, []);

  const totais = useMemo(() => {
    const t = { previsto: 0, confirmado: 0, aprovado: 0, pago: 0, estornado: 0 };
    for (const l of lista) t[l.status] += centavos(l.valor_partner);
    return t;
  }, [lista]);

  const selecionadosLista = lista.filter(l => selecionados.has(l.id));
  const somaSelecionados = selecionadosLista.reduce((s, l) => s + centavos(l.valor_partner), 0);

  async function agir(acao, ids, corpo = {}) {
    setAgindo(true);
    try {
      const url = ids.length === 1 && acao !== 'aprovar' && acao !== 'pagar'
        ? `/partner-comissoes/admin/lancamentos/${ids[0]}/${acao}`
        : `/partner-comissoes/admin/lancamentos/${acao}`;
      const r = await api.post(url, { ids, ...corpo });
      const { alterados = [], recusados = [] } = r.data;
      if (alterados.length) toast.success(`${alterados.length} lançamento(s) atualizado(s)`);
      if (recusados.length) toast.error(`${recusados.length} recusado(s): ${recusados[0].motivo}`, { duration: 6000 });
      setModal(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally { setAgindo(false); }
  }

  const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }));
  const alternar = id => setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(STATUS_LANC).map(([k, s]) => (
          <button key={k} onClick={() => set('status', filtros.status === k ? '' : k)}
            className={`rounded-2xl p-3 border text-left ${filtros.status === k ? 'ring-2 ring-movv-900' : ''} ${s.classe}`}>
            <p className="text-xs font-medium uppercase tracking-wide">{s.rotulo}</p>
            <p className="text-lg font-bold">{reais(totais[k])}</p>
          </button>
        ))}
      </div>

      <div className="card py-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select className="input" value={filtros.partner_id} onChange={e => set('partner_id', e.target.value)}>
          <option value="">Todos os Partners</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
        <input className="input" type="month" value={filtros.competencia} onChange={e => set('competencia', e.target.value)} />
        <select className="input" value={filtros.status} onChange={e => set('status', e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LANC).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
        </select>
        <select className="input" value={filtros.origem} onChange={e => set('origem', e.target.value)}>
          <option value="">Todas as origens</option>
          {Object.entries(ORIGEM).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
        <button className="btn-primary flex items-center justify-center gap-2" onClick={() => setModal({ tipo: 'manual' })}>
          <Plus className="w-4 h-4" /> Lançamento manual
        </button>
      </div>

      {selecionados.size > 0 && (
        <div className="card py-3 flex flex-wrap items-center gap-3 bg-slate-50">
          <span className="text-sm text-slate-700">{selecionados.size} selecionado(s) · {reais(somaSelecionados)}</span>
          <button disabled={agindo} className="btn-secondary text-sm" onClick={() => agir('aprovar', [...selecionados])}>Aprovar selecionados</button>
          <button disabled={agindo} className="btn-secondary text-sm" onClick={() => setModal({ tipo: 'pagar', ids: [...selecionados] })}>Marcar selecionados como pagos</button>
          <button className="text-sm text-slate-500 underline" onClick={() => setSelecionados(new Set())}>limpar</button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 px-3 w-8" />
                {['Partner', 'Venda', 'Competência', 'Base', '%', 'Valor', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-movv-900 mx-auto" /></td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Nenhum lançamento</td></tr>
              ) : lista.map(l => {
                const st = STATUS_LANC[l.status];
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="py-3 px-3">
                      {['confirmado', 'aprovado'].includes(l.status) && (
                        <input type="checkbox" checked={selecionados.has(l.id)} onChange={() => alternar(l.id)} />
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <p className="text-slate-900 font-medium">{l.partner_nome}</p>
                      <p className="text-[#C9A84C] font-mono">{l.partner_codigo} · {NIVEIS[l.nivel_partner] || 'sem nível'}</p>
                    </td>
                    <td className="py-3 px-3 text-xs max-w-[220px]">
                      <p className="text-slate-900">{l.produto}</p>
                      <p className="text-slate-500 truncate">{l.cliente_nome || '—'}{l.numero_contrato ? ` · ${l.numero_contrato}` : ''}</p>
                      <p className="text-slate-400">#{l.id} · {ORIGEM[l.origem]}{l.lancado_manualmente ? ' · manual' : ''}{l.direta_sale_id ? ` · venda ${l.direta_sale_id}` : ''}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{competenciaBR(l.competencia)}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{reais(l.base_valor)}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{pct(l.percentual)}</td>
                    <td className="py-3 px-3 whitespace-nowrap font-semibold">{reais(l.valor_partner)}</td>
                    <td className="py-3 px-3 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-medium border ${st.classe}`}>{st.rotulo}</span>
                      <Trilha l={l} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {l.status === 'previsto' && <BotaoAcao icone={CheckCircle2} rotulo="Confirmar" onClick={() => agir('confirmar', [l.id])} disabled={agindo} />}
                        {l.status === 'confirmado' && <BotaoAcao icone={CheckCircle2} rotulo="Aprovar" onClick={() => agir('aprovar', [l.id])} disabled={agindo} />}
                        {l.status === 'aprovado' && <BotaoAcao icone={Wallet} rotulo="Pagar" onClick={() => setModal({ tipo: 'pagar', ids: [l.id] })} disabled={agindo} />}
                        {l.status !== 'estornado' && <BotaoAcao icone={Undo2} rotulo="Estornar" perigo onClick={() => setModal({ tipo: 'estornar', ids: [l.id] })} disabled={agindo} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.tipo === 'pagar' && <ModalPagar ids={modal.ids} agindo={agindo} onFechar={() => setModal(null)} onConfirmar={c => agir('pagar', modal.ids, c)} />}
      {modal?.tipo === 'estornar' && <ModalEstornar agindo={agindo} onFechar={() => setModal(null)} onConfirmar={c => agir('estornar', modal.ids, c)} />}
      {modal?.tipo === 'manual' && <ModalManual partners={partners} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />}
    </div>
  );
}

function Trilha({ l }) {
  const linhas = [];
  if (l.confirmado_por) linhas.push(`Confirmado por ${l.confirmado_por}`);
  if (l.aprovado_por) linhas.push(`Aprovado por ${l.aprovado_por}`);
  if (l.pago_por) linhas.push(`Pago em ${dataBR(l.pago_em)} por ${l.pago_por}${l.observacao_pagamento ? ` (${l.observacao_pagamento})` : ''}`);
  if (l.estornado_por) linhas.push(`Estornado por ${l.estornado_por}: ${l.motivo_estorno}`);
  if (l.observacao) linhas.push(`Obs.: ${l.observacao}`);
  if (!linhas.length) return null;
  return <div className="mt-1 space-y-0.5 text-[11px] leading-tight text-slate-400 max-w-[220px]">{linhas.map((x, i) => <p key={i}>{x}</p>)}</div>;
}

function BotaoAcao({ icone: Icone, rotulo, onClick, disabled, perigo }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${perigo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-700 hover:bg-slate-100'} disabled:opacity-50`}>
      <Icone className="w-3.5 h-3.5" />{rotulo}
    </button>
  );
}

function Modal({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

function ModalPagar({ ids, agindo, onFechar, onConfirmar }) {
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState('');
  return (
    <Modal titulo={`Marcar ${ids.length} lançamento(s) como pago`} onFechar={onFechar}>
      <p className="text-sm text-slate-600">Só lançamentos aprovados viram pagos; os outros voltam como recusados.</p>
      <div><label className="label">Data do pagamento</label><input type="date" className="input" value={data} onChange={e => setData(e.target.value)} /></div>
      <div><label className="label">Observação (opcional)</label><input className="input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: PIX, lote de outubro" /></div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onFechar}>Voltar</button>
        <button className="btn-primary" disabled={agindo || !data} onClick={() => onConfirmar({ data_pagamento: data, observacao: obs })}>Confirmar pagamento</button>
      </div>
    </Modal>
  );
}

function ModalEstornar({ agindo, onFechar, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal titulo="Estornar lançamento" onFechar={onFechar}>
      <p className="text-sm text-slate-600">O lançamento fica visível para o Partner como estornado e sai dos totais. Não dá para desfazer.</p>
      <div><label className="label">Motivo</label><textarea className="input min-h-[80px]" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onFechar}>Voltar</button>
        <button className="btn-danger" disabled={agindo || !motivo.trim()} onClick={() => onConfirmar({ motivo })}>Estornar</button>
      </div>
    </Modal>
  );
}

function ModalManual({ partners, onFechar, onSalvo }) {
  const [f, setF] = useState({ partner_id: '', origem: 'azul', produto: '', competencia: hoje().slice(0, 7), base_valor: '', numero_contrato: '', cliente_nome: '', status_inicial: 'confirmado', observacao: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  async function salvar() {
    setSalvando(true);
    try {
      // "1.234,56" ou "133,44" (vírgula decimal) ou "133.44" (ponto decimal)
      const b = f.base_valor.trim();
      const base = b.includes(',') ? b.replace(/\./g, '').replace(',', '.') : b;
      await api.post('/partner-comissoes/admin/lancamentos', { ...f, base_valor: base });
      toast.success('Lançamento criado');
      onSalvo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar lançamento');
    } finally { setSalvando(false); }
  }
  const ativos = partners.filter(p => p.is_active);
  return (
    <Modal titulo="Lançamento manual" onFechar={onFechar}>
      <p className="text-sm text-slate-600">Para casos fora da importação da Azul. O percentual vem da regra vigente do nível do Partner no 1º dia da competência.</p>
      <div><label className="label">Partner</label>
        <select className="input" value={f.partner_id} onChange={e => set('partner_id', e.target.value)}>
          <option value="">Escolha…</option>
          {ativos.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code}) · {NIVEIS[p.nivel_partner] || 'sem nível'}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Origem</label>
          <select className="input" value={f.origem} onChange={e => set('origem', e.target.value)}>
            <option value="azul">Azul</option><option value="certificado">Movv Certificado</option>
          </select>
        </div>
        <div><label className="label">Competência</label><input type="month" className="input" value={f.competencia} onChange={e => set('competencia', e.target.value)} /></div>
      </div>
      <div><label className="label">Produto</label><input className="input" value={f.produto} onChange={e => set('produto', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Base (R$)</label><input className="input" inputMode="decimal" value={f.base_valor} onChange={e => set('base_valor', e.target.value)} placeholder="133,44" /></div>
        <div><label className="label">Nasce como</label>
          <select className="input" value={f.status_inicial} onChange={e => set('status_inicial', e.target.value)}>
            <option value="confirmado">Confirmado (o Grupo já recebeu)</option><option value="previsto">Previsto</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Cliente (opcional)</label><input className="input" value={f.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} /></div>
        <div><label className="label">Contrato (opcional)</label><input className="input" value={f.numero_contrato} onChange={e => set('numero_contrato', e.target.value.replace(/\D/g, ''))} /></div>
      </div>
      <div><label className="label">Por que é manual? (obrigatório)</label><textarea className="input min-h-[70px]" value={f.observacao} onChange={e => set('observacao', e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onFechar}>Voltar</button>
        <button className="btn-primary" disabled={salvando || !f.partner_id || !f.produto || !f.base_valor || !f.observacao.trim()} onClick={salvar}>Criar lançamento</button>
      </div>
    </Modal>
  );
}

// ─── Regras ─────────────────────────────────────────────────────────────────

const BASES_POR_ORIGEM = { azul: ['comissao_recebida'], certificado: ['lucro_grupo', 'valor_venda'] };

function Regras() {
  const { user } = useAuth();
  const podeEditar = Boolean(user?.is_admin);
  const [regras, setRegras] = useState(null);
  const [editando, setEditando] = useState(null);
  const carregar = useCallback(() => {
    api.get('/partner-comissoes/admin/regras').then(r => setRegras(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Erro ao carregar regras'));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const hojeStr = hoje();
  const vigente = r => r.vigente_desde <= hojeStr && (!r.vigente_ate || r.vigente_ate >= hojeStr);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 max-w-2xl">O percentual é copiado para cada lançamento quando ele nasce; mudar a regra só vale para os próximos. Para trocar um percentual sem perder o histórico, encerre a regra atual (data de fim) e crie uma nova.</p>
        {podeEditar && <button className="btn-primary flex items-center gap-2" onClick={() => setEditando({})}><Plus className="w-4 h-4" /> Nova regra</button>}
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>{['Origem', 'Produto', 'Nível', 'Percentual', 'Vigência', 'Situação', ''].map(h => <th key={h} className="text-left text-slate-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {!regras ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-movv-900 mx-auto" /></td></tr>
              ) : regras.map(r => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-3 px-3">{ORIGEM[r.origem]}</td>
                  <td className="py-3 px-3">{r.produto || <span className="text-slate-400">todos</span>}</td>
                  <td className="py-3 px-3">{NIVEIS[r.nivel_partner]}</td>
                  <td className="py-3 px-3 font-semibold">{pct(r.percentual)} <span className="font-normal text-slate-500 text-xs">{BASE[r.base]}</span></td>
                  <td className="py-3 px-3 whitespace-nowrap">{dataBR(r.vigente_desde)} → {r.vigente_ate ? dataBR(r.vigente_ate) : 'sem fim'}</td>
                  <td className="py-3 px-3">{vigente(r) ? <span className="text-emerald-700 font-medium">vigente</span> : <span className="text-slate-400">fora da vigência</span>}</td>
                  <td className="py-3 px-3">{podeEditar && <button className="text-slate-500 hover:text-movv-900" onClick={() => setEditando(r)}><Pencil className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!podeEditar && <p className="text-xs text-slate-500">Só o administrador altera as regras.</p>}
      {editando && <ModalRegra regra={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalRegra({ regra, onFechar, onSalvo }) {
  const nova = !regra.id;
  const [f, setF] = useState({
    origem: regra.origem || 'certificado', produto: regra.produto || '', nivel_partner: regra.nivel_partner || 'mobile',
    base: regra.base || 'lucro_grupo', percentual: regra.percentual ? String(Number(regra.percentual)) : '',
    vigente_desde: regra.vigente_desde || hoje(), vigente_ate: regra.vigente_ate || '', observacao: regra.observacao || '',
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => {
    const n = { ...x, [k]: v };
    if (k === 'origem') n.base = BASES_POR_ORIGEM[v][0];
    return n;
  });
  async function salvar() {
    setSalvando(true);
    try {
      const corpo = { ...f, percentual: f.percentual.replace(',', '.') };
      if (nova) await api.post('/partner-comissoes/admin/regras', corpo);
      else await api.put(`/partner-comissoes/admin/regras/${regra.id}`, corpo);
      toast.success('Regra salva');
      onSalvo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar regra');
    } finally { setSalvando(false); }
  }
  return (
    <Modal titulo={nova ? 'Nova regra' : `Editar regra #${regra.id}`} onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Origem</label>
          <select className="input" value={f.origem} onChange={e => set('origem', e.target.value)}>
            <option value="azul">Azul</option><option value="certificado">Movv Certificado</option>
          </select>
        </div>
        <div><label className="label">Nível</label>
          <select className="input" value={f.nivel_partner} onChange={e => set('nivel_partner', e.target.value)}>
            {Object.entries(NIVEIS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </div>
      </div>
      <div><label className="label">Produto (vazio = todos os produtos da origem)</label><input className="input" value={f.produto} onChange={e => set('produto', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Percentual (%)</label><input className="input" inputMode="decimal" value={f.percentual} onChange={e => set('percentual', e.target.value)} placeholder="30" /></div>
        <div><label className="label">Sobre</label>
          <select className="input" value={f.base} onChange={e => set('base', e.target.value)}>
            {BASES_POR_ORIGEM[f.origem].map(b => <option key={b} value={b}>{BASE[b]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Vigente desde</label><input type="date" className="input" value={f.vigente_desde} onChange={e => set('vigente_desde', e.target.value)} /></div>
        <div><label className="label">Até (opcional)</label><input type="date" className="input" value={f.vigente_ate} onChange={e => set('vigente_ate', e.target.value)} /></div>
      </div>
      <div><label className="label">Observação</label><input className="input" value={f.observacao} onChange={e => set('observacao', e.target.value)} /></div>
      {!nova && <p className="text-xs text-amber-700">Editar não muda lançamentos que já existem: eles guardaram o percentual do dia em que nasceram.</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onFechar}>Voltar</button>
        <button className="btn-primary" disabled={salvando || !f.percentual || !f.vigente_desde} onClick={salvar}>Salvar</button>
      </div>
    </Modal>
  );
}

// ─── Avisos ─────────────────────────────────────────────────────────────────

function Avisos({ visivel, onContagem }) {
  const [avisos, setAvisos] = useState(null);
  const [tentando, setTentando] = useState(null);
  const carregar = useCallback(() => {
    api.get('/partner-comissoes/admin/avisos').then(r => { setAvisos(r.data); onContagem(r.data.length); })
      .catch(() => {});
  }, [onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function tentar(id) {
    setTentando(id);
    try {
      const r = await api.post(`/partner-comissoes/admin/avisos/${id}/tentar`);
      if (r.data.lancamento) toast.success(`Lançamento #${r.data.lancamento.id} gerado`);
      else if (r.data.aviso) toast.error(r.data.aviso, { duration: 6000 });
      else toast.success('Resolvido');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao tentar de novo');
    } finally { setTentando(null); }
  }

  if (!visivel) return null;
  if (!avisos) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>;
  if (!avisos.length) return <div className="card text-center py-10 text-slate-500 text-sm">Nenhum aviso em aberto.</div>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Vendas que deveriam gerar comissão para o Partner e não geraram. Corrija a causa (regra, nível do Partner) e clique em “Tentar de novo”.</p>
      {avisos.map(a => (
        <div key={a.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="text-slate-900">{a.motivo}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ORIGEM[a.origem] || a.origem}{a.direta_sale_id ? ` · venda ${a.direta_sale_id}` : ''}{a.cliente_nome ? ` · ${a.cliente_nome}` : ''}
              {a.total_venda ? ` · ${reais(a.total_venda)}` : ''}{a.partner_nome ? ` · ${a.partner_nome} (${a.partner_codigo})` : ''} · {dataBR(a.data_venda)}
            </p>
          </div>
          <button className="btn-secondary text-sm flex items-center gap-1" disabled={tentando === a.id} onClick={() => tentar(a.id)}>
            <RefreshCw className={`w-4 h-4 ${tentando === a.id ? 'animate-spin' : ''}`} /> Tentar de novo
          </button>
        </div>
      ))}
    </div>
  );
}

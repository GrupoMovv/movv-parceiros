import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, AlertTriangle, Search, Link2, X, RefreshCw, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';
import { reais, competenciaBR, dataBR } from '../universidade/comissoesRotulos';

// Importação mensal do relatório da Azul (livro de comissões do Partner,
// Etapa 2) e as pendências que ela gera. O arquivo vai para o servidor só
// para ler; o navegador não guarda nada. CPF sempre mascarado na tela.

const ROTULO_STATUS = {
  casada: 'Casada por contrato', sugestao: 'Sugestão por CPF', ambigua: 'CPF ambíguo', sem_partner: 'Sem Partner',
  sem_regra: 'Partner sem regra/nível', desconto: 'Desconto', estorno_a_decidir: 'Estorno a decidir',
};
const COR_STATUS = {
  casada: 'bg-emerald-50 text-emerald-700 border-emerald-200', sugestao: 'bg-amber-50 text-amber-700 border-amber-200',
  ambigua: 'bg-orange-50 text-orange-700 border-orange-200', sem_partner: 'bg-slate-100 text-slate-500 border-slate-200',
  sem_regra: 'bg-red-50 text-red-600 border-red-200', desconto: 'bg-slate-100 text-slate-600 border-slate-200',
  estorno_a_decidir: 'bg-red-50 text-red-600 border-red-200',
};
const LONGO = { timeout: 120000 };

function Selo({ status, ja }) {
  if (ja) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs border bg-slate-50 text-slate-400 border-slate-200">Já importada</span>;
  if (!status) return null;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${COR_STATUS[status] || ''}`}>{ROTULO_STATUS[status] || status}</span>;
}

// ─── Importar ───────────────────────────────────────────────────────────────

export function ImportacaoAzul({ onImportou }) {
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [mostrarLinhas, setMostrarLinhas] = useState(false);
  const input = useRef(null);

  const carregarHistorico = useCallback(() => {
    api.get('/partner-comissoes/admin/importacao/historico').then(r => setHistorico(r.data)).catch(() => {});
  }, []);
  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  function formData() {
    const f = new FormData();
    f.append('arquivo', arquivo);
    return f;
  }

  async function lerPrevia(file) {
    setArquivo(file);
    setPrevia(null);
    if (!file) return;
    setLendo(true);
    try {
      const f = new FormData();
      f.append('arquivo', file);
      const r = await api.post('/partner-comissoes/admin/importacao/previa', f, LONGO);
      setPrevia(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao ler o arquivo');
    } finally { setLendo(false); }
  }

  async function confirmar() {
    setGravando(true);
    try {
      const r = await api.post('/partner-comissoes/admin/importacao/confirmar', formData(), LONGO);
      toast.success(`Importação gravada: ${r.data.importacao.linhas_novas} linha(s) nova(s), ${reais(r.data.importacao.total_partners)} para Partners`);
      setArquivo(null);
      setPrevia(null);
      if (input.current) input.current.value = '';
      carregarHistorico();
      onImportou?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao importar');
    } finally { setGravando(false); }
  }

  const c = previa?.contagens || {};
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-movv-900" /><h3 className="font-semibold text-slate-900">Importar relatório "Comissões pagas" da Azul</h3></div>
        <p className="text-sm text-slate-600">Use o <strong>Exportar CSV Domus</strong> (ou o .xls do relatório). Pode exportar períodos que se sobrepõem: linha já importada não entra de novo. Primeiro vem a prévia; nada é gravado até você confirmar.</p>
        <input ref={input} type="file" accept=".csv,.xls,.txt" className="block text-sm" onChange={e => lerPrevia(e.target.files?.[0] || null)} />
        {lendo && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o arquivo…</p>}
      </div>

      {previa && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Prévia — {arquivo?.name}</h3>
            <p className="text-xs text-slate-500">{previa.formato === 'csv_domus' ? 'CSV Domus' : '.xls da Azul'} · pagamentos de {dataBR(previa.periodo_de)} a {dataBR(previa.periodo_ate)}</p>
          </div>
          {previa.erros.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">{previa.erros.length} linha(s) com erro — a importação fica bloqueada até corrigir o arquivo:</p>
              <ul className="list-disc ml-5 mt-1">{previa.erros.slice(0, 10).map(e => <li key={e.linha_numero}>linha {e.linha_numero}: {e.motivo}</li>)}</ul>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Num rotulo="Linhas no arquivo" valor={previa.linhas_total} />
            <Num rotulo="Já importadas" valor={previa.ja_importadas} />
            <Num rotulo="Novas" valor={previa.novas} destaque />
            <Num rotulo="Casadas por contrato" valor={c.casada} />
            <Num rotulo="Sugestões por CPF" valor={c.sugestao} />
            <Num rotulo="CPF ambíguo" valor={c.ambigua} />
            <Num rotulo="Sem Partner" valor={c.sem_partner} />
            <Num rotulo="Descontos" valor={c.desconto} />
            <Num rotulo="Estornos a decidir" valor={c.estorno_a_decidir} />
            {c.sem_regra > 0 && <Num rotulo="De Partner sem regra/nível" valor={c.sem_regra} />}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Incentivo da Azul no arquivo</p>
              <p className="text-lg font-bold text-slate-900">{reais(previa.total_incentivo_bruto)}</p>
              <p className="text-xs text-slate-500">{previa.linhas_pagas} linhas pagas · descontos {reais(previa.total_descontos)} · líquido <strong>{reais(previa.total_incentivo_liquido)}</strong></p>
              {previa.total_estornos !== '0.00' && <p className="text-xs text-red-600">estornos com contrato: {reais(previa.total_estornos)}</p>}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700 uppercase tracking-wide">Será lançado para Partners</p>
              <p className="text-lg font-bold text-emerald-800">{reais(previa.total_partners)}</p>
              <p className="text-xs text-emerald-700">só as casadas por contrato; sugestões e ambíguas entram quando você confirmar</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Pabline (só informativo)</p>
              <p className="text-sm text-slate-700">10% do bruto: <strong>{reais(previa.pabline.dez_pct_bruto)}</strong></p>
              <p className="text-sm text-slate-700">10% do líquido: <strong>{reais(previa.pabline.dez_pct_liquido)}</strong></p>
              <p className="text-xs text-slate-400">Nada é gravado no cálculo dela.</p>
            </div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Incentivo por produto</summary>
            <table className="mt-2 text-sm"><tbody>{previa.por_produto.map(p => <tr key={p.produto}><td className="pr-6 py-0.5">{p.produto}</td><td className="text-right">{reais(p.total)}</td></tr>)}</tbody></table>
          </details>
          <button className="text-sm text-movv-900 underline" onClick={() => setMostrarLinhas(v => !v)}>{mostrarLinhas ? 'Esconder' : 'Ver'} as linhas</button>
          {mostrarLinhas && (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50"><tr>{['#', 'Cliente', 'CPF', 'Contrato', 'Produto', 'Pagamento', 'Incentivo', 'Situação', 'Partner'].map(h => <th key={h} className="text-left px-2 py-2 text-slate-500">{h}</th>)}</tr></thead>
                <tbody>{previa.linhas.map(l => (
                  <tr key={l.linha_numero} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{l.linha_numero}</td>
                    <td className="px-2 py-1.5">{l.cliente_nome || l.tipo}</td>
                    <td className="px-2 py-1.5 font-mono">{l.cliente_cpf || '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{l.numero_contrato || '—'}</td>
                    <td className="px-2 py-1.5">{l.produto || '—'}</td>
                    <td className="px-2 py-1.5">{dataBR(l.dt_pagamento)}</td>
                    <td className="px-2 py-1.5 text-right">{reais(l.valor_comissao)}</td>
                    <td className="px-2 py-1.5"><Selo status={l.status} ja={l.ja_importada} /></td>
                    <td className="px-2 py-1.5">{l.valor_partner ? reais(l.valor_partner) : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setPrevia(null); setArquivo(null); if (input.current) input.current.value = ''; }}>Cancelar</button>
            <button className="btn-primary" disabled={gravando || previa.erros.length > 0 || previa.novas === 0} onClick={confirmar}>
              {gravando ? 'Gravando…' : previa.novas === 0 ? 'Nada novo para importar' : `Confirmar importação (${previa.novas} nova${previa.novas > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <p className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-100">Importações feitas</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{['Quando', 'Arquivo', 'Período', 'Novas / já vistas', 'Incentivo', 'Para Partners', 'Quem'].map(h => <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {historico.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-slate-400">Nenhuma importação ainda</td></tr> : historico.map(h => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(h.importado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{h.arquivo_nome}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{dataBR(h.periodo_de)} a {dataBR(h.periodo_ate)}</td>
                  <td className="px-3 py-2">{h.linhas_novas} / {h.linhas_ja_importadas}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{reais(h.total_incentivo)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{reais(h.total_partners)}</td>
                  <td className="px-3 py-2">{h.importado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Num({ rotulo, valor, destaque }) {
  return (
    <div className={`rounded-xl border p-2 ${destaque ? 'border-movv-900 bg-blue-50' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-bold text-slate-900">{valor ?? 0}</p>
    </div>
  );
}

// ─── Pendências ─────────────────────────────────────────────────────────────

export function PendenciasAzul({ onContagem }) {
  const [p, setP] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const [agindo, setAgindo] = useState(false);
  const [vinculando, setVinculando] = useState(null); // linha
  const [estorno, setEstorno] = useState(null);       // linha

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/partner-comissoes/admin/importacao/pendencias');
      setP(r.data);
      setMarcadas(new Set());
      onContagem?.(r.data.sugestoes.length + r.data.ambiguas.length + r.data.estornos.length + r.data.sem_regra.length);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao carregar pendências');
    }
  }, [onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  async function rodar(fn, ok) {
    setAgindo(true);
    try { await fn(); if (ok) toast.success(ok); await carregar(); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
    finally { setAgindo(false); }
  }

  async function confirmarLote(ids) {
    await rodar(async () => {
      const r = await api.post('/partner-comissoes/admin/importacao/sugestoes/confirmar', { linha_ids: ids }, LONGO);
      if (r.data.feitos.length) toast.success(`${r.data.feitos.length} sugestão(ões) confirmada(s)`);
      if (r.data.recusados.length) toast.error(`${r.data.recusados.length} recusada(s): ${r.data.recusados[0].motivo}`, { duration: 8000 });
    });
  }

  if (!p) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>;
  const vazio = !p.sugestoes.length && !p.ambiguas.length && !p.estornos.length && !p.sem_regra.length;

  return (
    <div className="space-y-5">
      {vazio && <div className="card text-center py-8 text-slate-500 text-sm">Nenhuma pendência da importação. Linhas “sem Partner” (vendas da própria agência) não são pendência.</div>}

      {p.sugestoes.length > 0 && (
        <Bloco titulo={`Sugestões por CPF (${p.sugestoes.length})`} explica="O CPF da linha bate com uma indicação de Partner que ainda não tem contrato. Ao confirmar, o contrato é gravado na indicação e o lançamento é gerado.">
          <div className="flex flex-wrap gap-2 mb-2">
            <button className="btn-primary text-sm" disabled={agindo || !marcadas.size} onClick={() => confirmarLote([...marcadas])}>Confirmar selecionadas ({marcadas.size})</button>
            <button className="btn-secondary text-sm" disabled={agindo} onClick={() => setMarcadas(new Set(p.sugestoes.map(s => s.id)))}>Selecionar todas</button>
          </div>
          {p.sugestoes.map(s => (
            <div key={s.id} className="flex flex-col lg:flex-row lg:items-center gap-2 py-2 border-t border-slate-100 text-sm">
              <input type="checkbox" className="self-start lg:self-center" checked={marcadas.has(s.id)}
                onChange={() => setMarcadas(m => { const n = new Set(m); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })} />
              <LinhaResumo l={s} />
              <div className="lg:w-64 text-xs text-slate-600">→ indicação <span className="font-mono">{s.protocol}</span> de <strong>{s.indicacao_cliente}</strong><br />{s.partner_nome} ({s.partner_codigo})</div>
              <div className="flex gap-1">
                <button className="btn-secondary text-xs" disabled={agindo} onClick={() => confirmarLote([s.id])}>Confirmar</button>
                <button className="text-xs text-slate-500 underline" disabled={agindo} onClick={() => setVinculando(s)}>Outra indicação</button>
                <button className="text-xs text-red-600 underline" disabled={agindo} onClick={() => rodar(() => api.post(`/partner-comissoes/admin/importacao/linhas/${s.id}/descartar`), 'Marcada como sem Partner')}>Não é de Partner</button>
              </div>
            </div>
          ))}
        </Bloco>
      )}

      {p.ambiguas.length > 0 && (
        <Bloco titulo={`CPF ambíguo (${p.ambiguas.length})`} explica="O CPF bate com mais de uma indicação de Partner sem contrato (o mesmo cliente pode ter dois contratos). Escolha a indicação desta linha.">
          {p.ambiguas.map(a => (
            <div key={a.id} className="py-2 border-t border-slate-100 text-sm space-y-2">
              <LinhaResumo l={a} />
              <div className="flex flex-wrap gap-2">
                {a.candidatos.map(cand => (
                  <button key={cand.id} disabled={agindo} className="btn-secondary text-xs"
                    onClick={() => rodar(() => api.post(`/partner-comissoes/admin/importacao/linhas/${a.id}/vincular`, { referral_id: cand.id }), 'Vinculada')}>
                    {cand.partner_nome} · {cand.client_name} · {dataBR(cand.created_at)}
                  </button>
                ))}
                <button className="text-xs text-red-600 underline" disabled={agindo} onClick={() => rodar(() => api.post(`/partner-comissoes/admin/importacao/linhas/${a.id}/descartar`), 'Marcada como sem Partner')}>Não é de Partner</button>
              </div>
            </div>
          ))}
        </Bloco>
      )}

      {p.estornos.length > 0 && (
        <Bloco titulo={`Estornos a decidir (${p.estornos.length})`} explica="A Azul estornou um contrato de Partner. Nada foi alterado sozinho: decida caso a caso enquanto a política não é definida.">
          {p.estornos.map(e => (
            <div key={e.id} className="flex flex-col lg:flex-row lg:items-center gap-2 py-2 border-t border-slate-100 text-sm">
              <LinhaResumo l={e} />
              <div className="lg:w-56 text-xs text-slate-600">{e.partner_nome ? `${e.partner_nome} (${e.partner_codigo})` : ''}{e.lancamento_estorno_id ? ` · lançamento #${e.lancamento_estorno_id} ${e.lancamento_status} ${reais(e.lancamento_valor)}` : ' · sem lançamento'}</div>
              <button className="btn-secondary text-xs" onClick={() => setEstorno(e)}>Decidir</button>
            </div>
          ))}
        </Bloco>
      )}

      {p.sem_regra.length > 0 && (
        <Bloco titulo={`De Partner, mas sem regra ou nível (${p.sem_regra.length})`} explica="A linha é de um Partner, mas não deu para calcular: corrija o nível do Partner ou a regra e tente de novo.">
          {p.sem_regra.map(s => (
            <div key={s.id} className="flex flex-col lg:flex-row lg:items-center gap-2 py-2 border-t border-slate-100 text-sm">
              <LinhaResumo l={s} />
              <div className="lg:w-64 text-xs text-red-600">{s.motivo}</div>
              <button className="btn-secondary text-xs flex items-center gap-1" disabled={agindo} onClick={() => rodar(() => api.post(`/partner-comissoes/admin/importacao/linhas/${s.id}/tentar`), 'Lançamento gerado')}><RefreshCw className="w-3.5 h-3.5" /> Tentar de novo</button>
            </div>
          ))}
        </Bloco>
      )}

      <VinculoManual onVincular={linha => setVinculando(linha)} />

      {vinculando && <ModalVincular linha={vinculando} onFechar={() => setVinculando(null)} onFeito={() => { setVinculando(null); carregar(); }} />}
      {estorno && <ModalEstorno linha={estorno} onFechar={() => setEstorno(null)} onFeito={() => { setEstorno(null); carregar(); }} />}
    </div>
  );
}

function Bloco({ titulo, explica, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900">{titulo}</h3>
      <p className="text-xs text-slate-500 mb-2">{explica}</p>
      {children}
    </div>
  );
}

function LinhaResumo({ l }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-slate-900 truncate">{l.cliente_nome || '—'} <span className="font-mono text-xs text-slate-500">{l.cliente_cpf || ''}</span></p>
      <p className="text-xs text-slate-500">contrato <span className="font-mono">{l.numero_contrato || '—'}</span> · {l.produto || '—'} · pago em {dataBR(l.dt_pagamento)} ({competenciaBR(l.competencia)}) · incentivo {reais(l.valor_comissao)}</p>
    </div>
  );
}

function Modal({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// Busca uma linha "sem Partner" para corrigir à mão
function VinculoManual({ onVincular }) {
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState(null);
  async function buscar(e) {
    e.preventDefault();
    try {
      const r = await api.get('/partner-comissoes/admin/importacao/linhas', { params: { busca } });
      setLinhas(r.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro na busca'); }
  }
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900">Vincular à mão uma linha “sem Partner”</h3>
      <p className="text-xs text-slate-500 mb-2">Só para corrigir: busque pelo nome do cliente, pelo contrato ou pelo CPF completo.</p>
      <form onSubmit={buscar} className="flex gap-2">
        <input className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, contrato ou CPF" />
        <button className="btn-secondary flex items-center gap-1" disabled={busca.trim().length < 3}><Search className="w-4 h-4" /> Buscar</button>
      </form>
      {linhas && (linhas.length === 0 ? <p className="text-sm text-slate-500 mt-2">Nada encontrado.</p> : linhas.map(l => (
        <div key={l.id} className="flex items-center gap-2 py-2 border-t border-slate-100 mt-2 text-sm">
          <LinhaResumo l={l} />
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => onVincular(l)}><Link2 className="w-3.5 h-3.5" /> Vincular</button>
        </div>
      )))}
    </div>
  );
}

function ModalVincular({ linha, onFechar, onFeito }) {
  const [busca, setBusca] = useState(linha.cliente_nome?.split(' ').slice(0, 2).join(' ') || '');
  const [achadas, setAchadas] = useState(null);
  const [salvando, setSalvando] = useState(false);
  async function buscar(e) {
    e?.preventDefault();
    try {
      const r = await api.get('/partner-comissoes/admin/importacao/indicacoes', { params: { busca } });
      setAchadas(r.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro na busca'); }
  }
  async function vincular(id) {
    setSalvando(true);
    try {
      const r = await api.post(`/partner-comissoes/admin/importacao/linhas/${linha.id}/vincular`, { referral_id: id });
      if (r.data.sem_regra) toast.error(`Vinculada, mas sem lançamento: ${r.data.sem_regra}`, { duration: 8000 });
      else toast.success('Vinculada; lançamento gerado');
      onFeito();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao vincular');
    } finally { setSalvando(false); }
  }
  return (
    <Modal titulo="Vincular a uma indicação de Partner" onFechar={onFechar}>
      <LinhaResumo l={linha} />
      <form onSubmit={buscar} className="flex gap-2">
        <input className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Cliente, protocolo, código do Partner ou CPF" />
        <button className="btn-secondary" disabled={busca.trim().length < 3}>Buscar</button>
      </form>
      {achadas && (achadas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma indicação Azul de Partner encontrada.</p> : achadas.map(a => (
        <div key={a.id} className="flex items-center gap-2 py-2 border-t border-slate-100 text-sm">
          <div className="flex-1">
            <p className="text-slate-900">{a.client_name} <span className="font-mono text-xs text-slate-500">{a.client_cpf || ''}</span></p>
            <p className="text-xs text-slate-500">{a.partner_nome} ({a.partner_codigo}) · {a.produto} · {dataBR(a.created_at)} · {a.numero_contrato ? `contrato ${a.numero_contrato}` : 'sem contrato'}</p>
          </div>
          <button className="btn-primary text-xs" disabled={salvando || (a.numero_contrato && a.numero_contrato !== linha.numero_contrato)} onClick={() => vincular(a.id)}>Vincular</button>
        </div>
      )))}
      <p className="text-xs text-slate-500">Ao vincular, o contrato da linha é gravado na indicação (se ela ainda não tiver) e o lançamento do Partner é gerado como confirmado.</p>
    </Modal>
  );
}

function ModalEstorno({ linha, onFechar, onFeito }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function decidir(acao) {
    setSalvando(true);
    try {
      await api.post(`/partner-comissoes/admin/importacao/linhas/${linha.id}/estorno`, { acao, motivo });
      toast.success(acao === 'estornar' ? 'Lançamento estornado' : 'Lançamento mantido');
      onFeito();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    } finally { setSalvando(false); }
  }
  return (
    <Modal titulo="Estorno da Azul" onFechar={onFechar}>
      <LinhaResumo l={linha} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> A política de estorno ainda não foi definida; esta decisão vale só para este caso e fica registrada.</div>
      <div><label className="label">Motivo da decisão</label><textarea className="input min-h-[70px]" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" disabled={salvando || !motivo.trim()} onClick={() => decidir('manter')}><CheckCircle2 className="w-4 h-4 inline mr-1" />Manter o lançamento</button>
        <button className="btn-danger" disabled={salvando || !motivo.trim() || !linha.lancamento_estorno_id} onClick={() => decidir('estornar')}>Estornar o lançamento</button>
      </div>
    </Modal>
  );
}


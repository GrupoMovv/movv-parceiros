import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Copy, MessageCircle, UserPlus, Pencil, Power, RefreshCw, Bell, BellOff, Users, Download, Info } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { linkWhatsappComTexto } from '../../utils/carteirinhaWhatsapp';
import { ROXO, PRETO } from '../public/Marketplace/theme';

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';
const dataBR = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
const fmtWhats = w => (w?.length === 11 ? `(${w.slice(0, 2)}) ${w.slice(2, 7)}-${w.slice(7)}` : w?.length === 10 ? `(${w.slice(0, 2)}) ${w.slice(2, 6)}-${w.slice(6)}` : w);
const NOME_PLANO = { gratis: 'Grátis', oficial: 'Oficial', premium: 'Premium', master: 'Master' };

// Links do vendedor: loja (/v/CÓDIGO) e produto (?v=CÓDIGO). O endereço é o
// do próprio site, onde o painel roda (iubmais.com.br).
export const linkDaLoja = codigo => `${window.location.origin}/v/${codigo}`;
export const linkDoProduto = (produtoId, codigo) => `${window.location.origin}/marketplace/produto/${produtoId}?v=${codigo}`;

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast.success('Link copiado'); } catch { toast.error('Não deu para copiar. Selecione o link e copie.'); }
}
const mensagemVendedor = (nome, loja, link) => `Oi, ${nome.split(' ')[0]}! Este é o seu link de vendas da ${loja} no IUB MAIS+:\n${link}\n\nDivulgue para os seus clientes. Os pedidos feitos por ele contam para você.`;

// /parceiro/painel/equipe — Equipe de vendas da loja (migration 102). Não é o
// Vendedor Pessoa Física: aqui são funcionários da loja, sem login. Cada um
// tem um link próprio; a loja vê quanto cada um vendeu e paga a comissão do
// jeito dela. O WhatsApp do vendedor só a loja vê.
export default function EquipeVendas() {
  const { parceiro } = useOutletContext();
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null); // null | { id?, nome, whatsapp, avisar_whatsapp, autorizou, whatsappAntes }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('vendedores'); // vendedores | vendas

  const carregar = () => apiParceiro.get('/parceiro/equipe').then(r => setD(r.data)).catch(() => toast.error('Erro ao carregar a equipe'));
  useEffect(() => { carregar(); }, []);

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const noLimite = d.ativos >= d.limite;
  const ativos = d.vendedores.filter(v => v.ativo);
  const inativos = d.vendedores.filter(v => !v.ativo);
  const trocouWhats = form?.id && form.whatsapp.replace(/\D/g, '') !== form.whatsappAntes;
  const precisaAutorizar = !form?.id || trocouWhats;

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setSalvando(true);
    try {
      const corpo = { nome: form.nome, whatsapp: form.whatsapp, avisar_whatsapp: form.avisar_whatsapp, autorizou: form.autorizou };
      if (form.id) await apiParceiro.put(`/parceiro/equipe/${form.id}`, corpo);
      else await apiParceiro.post('/parceiro/equipe', corpo);
      toast.success(form.id ? 'Vendedor atualizado' : 'Vendedor cadastrado');
      setForm(null); await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Não deu para salvar agora.');
    } finally { setSalvando(false); }
  }

  async function agir(v, acao, ok) {
    try { await apiParceiro.post(`/parceiro/equipe/${v.id}/${acao}`); toast.success(ok); await carregar(); } catch (err) { toast.error(err.response?.data?.error || 'Não deu agora.'); }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-black flex items-center gap-2" style={{ color: PRETO }}><Users className="w-5 h-5" style={{ color: ROXO }} /> Equipe de vendas</h1>
        <p className="text-sm text-slate-600 mt-1">
          Cadastre seus vendedores. Cada um ganha um link próprio para divulgar. Você vê quanto cada um vendeu pelo IUB MAIS+ e paga a comissão do seu jeito.
          O IUB MAIS+ não paga comissão e não recebe dinheiro da venda. O vendedor não tem acesso ao painel e o cliente não vê nada disso.
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
        {[['vendedores', 'Vendedores'], ['vendas', 'Vendas por vendedor']].map(([k, rot]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg ${aba === k ? 'bg-white shadow-sm' : 'text-slate-500'}`} style={aba === k ? { color: ROXO } : undefined}>{rot}</button>
        ))}
      </div>

      {aba === 'vendas' ? <RelatorioVendas /> : (<>
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-700"><strong className="tabular-nums">{d.ativos} de {d.limite}</strong> {d.limite === 1 ? 'vendedor ativo' : 'vendedores ativos'} no plano {NOME_PLANO[d.plano] || d.plano}</p>
        {!form && (
          noLimite ? (
            <Link to="/parceiro/painel/planos" className="text-sm font-semibold underline" style={{ color: ROXO }}>Mais vendedores: ver planos</Link>
          ) : (
            <button type="button" onClick={() => { setErro(''); setForm({ nome: '', whatsapp: '', avisar_whatsapp: false, autorizou: false }); }}
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              <UserPlus className="w-4 h-4" /> Novo vendedor
            </button>
          )
        )}
      </div>

      {form && (
        <form onSubmit={salvar} className="rounded-2xl border-2 bg-white p-4 space-y-3" style={{ borderColor: ROXO }}>
          <p className="font-bold text-sm" style={{ color: PRETO }}>{form.id ? 'Editar vendedor' : 'Novo vendedor'}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">Nome
              <input className={`${campoCls} mt-1`} value={form.nome} maxLength={80} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Carla Souza" autoFocus />
            </label>
            <label className="block text-xs font-semibold text-slate-600">WhatsApp do vendedor
              <input className={`${campoCls} mt-1`} value={form.whatsapp} inputMode="tel" onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="64 99999-0000" />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={form.avisar_whatsapp} onChange={e => setForm({ ...form, avisar_whatsapp: e.target.checked })} />
            <span>Avisar o vendedor no WhatsApp quando entrar pedido pelo link dele <span className="text-slate-400">(sem dados do cliente: só o número do pedido e o valor)</span></span>
          </label>
          {precisaAutorizar && (
            <label className="flex items-start gap-2 text-sm text-slate-700 rounded-xl bg-slate-50 p-3">
              <input type="checkbox" className="mt-1" checked={form.autorizou} onChange={e => setForm({ ...form, autorizou: e.target.checked })} />
              <span><strong>O vendedor autorizou</strong> o cadastro do WhatsApp dele no IUB MAIS+ e o aviso de pedidos. Só a sua loja vê esse número. Guardamos a data, a hora e quem marcou.</span>
            </label>
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando || !form.nome.trim() || !form.whatsapp.trim() || (precisaAutorizar && !form.autorizou)}
              className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} {form.id ? 'Salvar' : 'Cadastrar'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600">Cancelar</button>
          </div>
        </form>
      )}

      {!d.vendedores.length && !form && (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-5 text-center">Nenhum vendedor ainda. Cadastre o primeiro em "Novo vendedor".</p>
      )}

      <div className="space-y-3">
        {ativos.map(v => (
          <CardVendedor key={v.id} v={v} loja={parceiro?.nome || 'loja'} produtos={d.produtos}
            onEditar={() => { setErro(''); setForm({ id: v.id, nome: v.nome, whatsapp: v.whatsapp, whatsappAntes: v.whatsapp, avisar_whatsapp: v.avisar_whatsapp, autorizou: false }); }}
            onDesativar={() => agir(v, 'desativar', `${v.nome} desativado`)}
            onNovoCodigo={() => agir(v, 'novo-codigo', 'Código novo gerado. O link antigo parou de valer.')} />
        ))}
      </div>

      {inativos.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Desativados (o histórico de vendas continua)</p>
          <div className="space-y-2">
            {inativos.map(v => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-600 truncate">{v.nome}</p>
                  <p className="text-xs text-slate-400">Desativado em {dataBR(v.desativado_em)} · o link não marca clientes novos</p>
                </div>
                <button type="button" disabled={noLimite} onClick={() => agir(v, 'ativar', `${v.nome} ativado`)} title={noLimite ? 'Limite do plano atingido' : ''}
                  className="text-xs font-bold px-3 py-2 rounded-lg border disabled:opacity-40" style={{ borderColor: ROXO, color: ROXO }}>Ativar</button>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodoPronto(tipo) {
  const hoje = new Date();
  if (tipo === 'mes_passado') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) };
  return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) };
}

// Vendas por vendedor (e4): só pedidos entregues no período (pela data da
// entrega). A loja escolhe a base da comissão: valor dos produtos (sem a
// entrega) ou valor total. Exporta planilha com o resumo e os pedidos.
function RelatorioVendas() {
  const [tipo, setTipo] = useState('este_mes');
  const [per, setPer] = useState(periodoPronto('este_mes'));
  const [rel, setRel] = useState(null);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    setErro('');
    apiParceiro.get('/parceiro/equipe/relatorio', { params: per })
      .then(r => setRel(r.data))
      .catch(err => { setRel(null); setErro(err.response?.data?.error || 'Não deu para carregar agora.'); });
  }, [per.de, per.ate]); // eslint-disable-line react-hooks/exhaustive-deps

  function escolher(t) {
    setTipo(t);
    if (t !== 'personalizado') setPer(periodoPronto(t));
  }

  async function exportar() {
    setBaixando(true);
    try {
      const r = await apiParceiro.get('/parceiro/equipe/relatorio.xlsx', { params: per, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `equipe-de-vendas-${per.de}-a-${per.ate}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      toast.error('Não deu para gerar a planilha agora.');
    } finally { setBaixando(false); }
  }

  const dataBRc = d => d.split('-').reverse().join('/');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {[['este_mes', 'Este mês'], ['mes_passado', 'Mês passado'], ['personalizado', 'Escolher datas']].map(([k, rot]) => (
          <button key={k} type="button" onClick={() => escolher(k)}
            className={`text-xs font-bold px-3 py-2 rounded-lg border ${tipo === k ? 'text-white' : 'bg-white text-slate-600 border-slate-200'}`}
            style={tipo === k ? { backgroundColor: ROXO, borderColor: ROXO } : undefined}>{rot}</button>
        ))}
        {tipo === 'personalizado' && (
          <div className="flex items-end gap-2">
            <label className="text-xs font-semibold text-slate-500">De<input type="date" className={`${campoCls} mt-1 py-1.5`} value={per.de} onChange={e => e.target.value && setPer({ ...per, de: e.target.value })} /></label>
            <label className="text-xs font-semibold text-slate-500">Até<input type="date" className={`${campoCls} mt-1 py-1.5`} value={per.ate} onChange={e => e.target.value && setPer({ ...per, ate: e.target.value })} /></label>
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {!rel && !erro && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {rel && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-4">
            <p className="text-sm font-bold" style={{ color: PRETO }}>{dataBRc(rel.de)} a {dataBRc(rel.ate)} · pedidos entregues</p>
            <button type="button" onClick={exportar} disabled={baixando}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border disabled:opacity-50" style={{ borderColor: ROXO, color: ROXO }}>
              {baixando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exportar planilha
            </button>
          </div>
          {/* Celular: uma linha por vendedor (a tabela de 4 colunas não cabe em 360 px) */}
          <ul className="sm:hidden mt-2 divide-y divide-slate-100">
            {[...rel.linhas, { vendedor_id: 'total', vendedor: 'Total', ...rel.total }].map(l => (
              <li key={l.vendedor_id ?? 'loja'} className={`px-4 py-3 ${l.vendedor_id === 'total' ? 'font-bold' : ''}`}>
                <p className={`text-sm ${l.vendedor_id === null ? 'text-slate-500' : ''}`} style={l.vendedor_id === null ? undefined : { color: PRETO }}>
                  {l.vendedor}{l.ativo === false && <span className="text-xs text-slate-400 font-normal"> (desativado)</span>}
                  <span className="text-xs text-slate-500 font-normal"> · {l.pedidos} {l.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5 tabular-nums">Produtos {brl(l.valor_produtos)} · Total {brl(l.valor_total)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="px-4 py-2">Vendedor</th><th className="px-2 py-2 text-right">Pedidos</th>
                <th className="px-2 py-2 text-right">Valor dos produtos</th><th className="px-4 py-2 text-right">Valor total</th>
              </tr></thead>
              <tbody>
                {rel.linhas.map(l => (
                  <tr key={l.vendedor_id ?? 'loja'} className="border-b border-slate-100">
                    <td className={`px-4 py-2.5 ${l.vendedor_id ? 'text-slate-900' : 'text-slate-500'}`}>{l.vendedor}{l.ativo === false && <span className="text-xs text-slate-400"> (desativado)</span>}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{l.pedidos}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">{brl(l.valor_produtos)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{brl(l.valor_total)}</td>
                  </tr>
                ))}
                <tr className="font-bold" style={{ color: PRETO }}>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{rel.total.pedidos}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">{brl(rel.total.valor_produtos)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{brl(rel.total.valor_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-4 pt-2 text-xs text-slate-500">"Valor dos produtos" não inclui a entrega. Use como base da comissão o valor que preferir.</p>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500 rounded-xl bg-slate-50 p-3">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>A atribuição é uma <strong>estimativa</strong>: o pedido conta para o vendedor cujo link o cliente usou por último nos 7 dias antes de comprar. Um cliente que recebeu o link e voltou sozinho dentro desse prazo também conta para o vendedor. Só entram pedidos feitos pelo site do IUB MAIS+ e já entregues.</span>
      </p>
    </div>
  );
}

function CardVendedor({ v, loja, produtos, onEditar, onDesativar, onNovoCodigo }) {
  const [produtoId, setProdutoId] = useState('');
  const [confirmar, setConfirmar] = useState(null); // 'desativar' | 'codigo'
  const link = linkDaLoja(v.codigo);
  const linkProd = produtoId ? linkDoProduto(produtoId, v.codigo) : null;
  const btn = 'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-bold text-sm" style={{ color: PRETO }}>{v.nome}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="tabular-nums">{fmtWhats(v.whatsapp)}</span>
            <span>·</span>
            {v.avisar_whatsapp ? <span className="inline-flex items-center gap-1"><Bell className="w-3 h-3" /> recebe aviso de pedido</span> : <span className="inline-flex items-center gap-1"><BellOff className="w-3 h-3" /> sem aviso</span>}
          </p>
        </div>
        <span className="font-mono text-sm font-bold tracking-widest px-3 py-1 rounded-lg bg-slate-100" style={{ color: ROXO }} title="Código do vendedor">{v.codigo}</span>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500">Link da loja</p>
        <p className="font-mono text-xs break-all select-all" style={{ color: PRETO }}>{link}</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => copiar(link)} className={`${btn} border border-slate-200 bg-white text-slate-700`}><Copy className="w-3.5 h-3.5" /> Copiar link</button>
          <a href={linkWhatsappComTexto(v.whatsapp, mensagemVendedor(v.nome, loja, link))} target="_blank" rel="noreferrer" className={`${btn} text-white`} style={{ backgroundColor: '#25D366' }}><MessageCircle className="w-3.5 h-3.5" /> Mandar no WhatsApp</a>
        </div>
      </div>

      {produtos.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <label className="block text-xs font-semibold text-slate-500">Link de um produto
            <select className={`${campoCls} mt-1 bg-white`} value={produtoId} onChange={e => setProdutoId(e.target.value)}>
              <option value="">Escolha o produto</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          {linkProd && (<>
            <p className="font-mono text-xs break-all select-all" style={{ color: PRETO }}>{linkProd}</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => copiar(linkProd)} className={`${btn} border border-slate-200 bg-white text-slate-700`}><Copy className="w-3.5 h-3.5" /> Copiar link</button>
              <a href={linkWhatsappComTexto(v.whatsapp, mensagemVendedor(v.nome, loja, linkProd))} target="_blank" rel="noreferrer" className={`${btn} text-white`} style={{ backgroundColor: '#25D366' }}><MessageCircle className="w-3.5 h-3.5" /> Mandar no WhatsApp</a>
            </div>
          </>)}
        </div>
      )}

      {confirmar ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
          <p>{confirmar === 'desativar'
            ? `Desativar ${v.nome}? O link dele para de marcar clientes novos. As vendas já feitas continuam no relatório.`
            : `Gerar código novo para ${v.nome}? O link antigo para de valer. As vendas já feitas continuam com ele.`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setConfirmar(null); (confirmar === 'desativar' ? onDesativar : onNovoCodigo)(); }} className={`${btn} text-white bg-amber-600`}>{confirmar === 'desativar' ? 'Desativar' : 'Gerar código novo'}</button>
            <button type="button" onClick={() => setConfirmar(null)} className={`${btn} border border-amber-300 bg-white`}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={onEditar} className={`${btn} border border-slate-200 text-slate-600`}><Pencil className="w-3.5 h-3.5" /> Editar</button>
          <button type="button" onClick={() => setConfirmar('codigo')} className={`${btn} border border-slate-200 text-slate-600`}><RefreshCw className="w-3.5 h-3.5" /> Gerar código novo</button>
          <button type="button" onClick={() => setConfirmar('desativar')} className={`${btn} border border-slate-200 text-slate-600`}><Power className="w-3.5 h-3.5" /> Desativar</button>
        </div>
      )}
      <p className="text-[11px] text-slate-400">Cadastrado em {dataBR(v.criado_em)} · autorização marcada em {dataBR(v.autorizou_em)}{v.autorizou_por ? ` por ${v.autorizou_por}` : ''}</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import apiPainel from '../../services/apiPainel';

// B1: o cliente muda os itens do pedido enquanto a loja não aceitou. O
// servidor recalcula tudo (preço do momento, Clube, Fecha Mês, estoque,
// promoção) e só grava se a loja ainda não aceitou. Não reinicia os 10
// minutos da loja. Tirar tudo = cancelar o pedido.
// modo 'complemento' (B2): depois do aceite, começa vazio e pede itens a
// mais, que a loja aceita ou recusa; sem taxa de entrega, Pix à parte.
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ROXO = '#5B21B6';

// item gravado no pedido → o que o servidor entende como item de entrada
function entradaDoItem(i) {
  if (i.beer_produto_id) return { tipo: 'beer', id: i.beer_produto_id };
  if (i.promocao_id) return { tipo: 'promocao', id: i.promocao_id };
  if (!i.produto_id && i.fecha_mes_produto_id) return { tipo: 'fecha_mes', id: i.fecha_mes_produto_id };
  return { tipo: 'produto', id: i.produto_id };
}

export default function MudarItensPedido({ pedido, aoSalvar, aoCancelarPedido, aoFechar, modo = 'mudar' }) {
  const complemento = modo === 'complemento';
  const [itens, setItens] = useState(() => (complemento ? [] : pedido.itens.map(i => ({ ...entradaDoItem(i), quantidade: i.quantidade, nome: i.nome }))));
  const [cotacao, setCotacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [catalogo, setCatalogo] = useState(null);
  const [abrirCatalogo, setAbrirCatalogo] = useState(false);
  const pedidoCotacao = useRef(0);

  // prévia do novo total (o que o pedido já reservou conta como livre)
  useEffect(() => {
    if (itens.length === 0) { setCotacao(null); setErro(null); return undefined; }
    const n = ++pedidoCotacao.current;
    const t = setTimeout(() => {
      apiPainel.post('/public/pedidos/cotacao', {
        ...(complemento ? { modo_recebimento: null } : { pedido_id: pedido.id, modo_recebimento: pedido.modo_recebimento }),
        itens: itens.map(({ tipo, id, quantidade }) => ({ tipo, id, quantidade })),
      })
        .then(r => { if (n === pedidoCotacao.current) { setCotacao(r.data); setErro(null); } })
        .catch(err => { if (n === pedidoCotacao.current) { setCotacao(null); setErro(err.response?.data?.error || 'Não conseguimos calcular agora.'); } });
    }, 350);
    return () => clearTimeout(t);
  }, [itens, pedido.id, pedido.modo_recebimento, complemento]);

  // complemento começa pela lista de produtos da loja
  useEffect(() => { if (complemento) verCatalogo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function mudarQtd(k, delta) {
    setAviso(null);
    setItens(lista => lista.map((i, j) => (j === k ? { ...i, quantidade: Math.max(0, Math.min(99, i.quantidade + delta)) } : i)).filter(i => i.quantidade > 0));
  }

  async function verCatalogo() {
    setAbrirCatalogo(true);
    if (catalogo) return;
    try {
      const r = await apiPainel.get(`/public/pedidos/${pedido.id}/produtos-da-loja`);
      setCatalogo(r.data.produtos);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos carregar os produtos da loja.');
      setAbrirCatalogo(false);
    }
  }

  function acrescentar(prod) {
    setAviso(null);
    setItens(lista => {
      const k = lista.findIndex(i => i.tipo === prod.tipo && i.id === prod.id);
      if (k >= 0) return lista.map((i, j) => (j === k ? { ...i, quantidade: Math.min(99, i.quantidade + 1) } : i));
      return [...lista, { tipo: prod.tipo, id: prod.id, quantidade: 1, nome: prod.nome }];
    });
    setAbrirCatalogo(false);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const corpo = { itens: itens.map(({ tipo, id, quantidade }) => ({ tipo, id, quantidade })), total_visto: cotacao?.total };
      const r = complemento
        ? await apiPainel.post(`/public/pedidos/${pedido.id}/complementos`, corpo)
        : await apiPainel.put(`/public/pedidos/${pedido.id}/itens`, corpo);
      toast.success(complemento ? 'Complemento enviado! A loja tem até 10 minutos para responder.' : 'Pedido mudado! A loja já foi avisada.');
      aoSalvar(r.data);
    } catch (err) {
      const d = err.response?.data || {};
      if (d.code === 'PRECO_MUDOU' && d.resumo) {
        setCotacao(d.resumo);
        setAviso(`O preço mudou. O novo total é ${brl(d.resumo.total)}. Confira e salve de novo.`);
      } else if (['JA_ACEITO', 'STATUS_MUDOU', 'PRAZO_ESGOTADO', 'JA_SAIU', 'JA_TEM_COMPLEMENTO', 'AINDA_NAO_ACEITO'].includes(d.code)) {
        toast.error(d.error);
        aoFechar(true);
      } else {
        setAviso(d.error || 'Não conseguimos mudar o pedido agora.');
      }
    } finally {
      setSalvando(false);
    }
  }

  const precoDe = (tipo, id) => cotacao?.itens?.find(x => { const e = entradaDoItem(x); return e.tipo === tipo && e.id === id; });

  return (
    <div className="bg-white rounded-2xl border-2 p-5 space-y-4" style={{ borderColor: ROXO }}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: ROXO }}>{complemento ? `Pedir mais itens no pedido #${pedido.id}` : `Mudar itens do pedido #${pedido.id}`}</h2>
        <button type="button" onClick={() => aoFechar(false)} aria-label="Fechar" className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
      </div>
      <p className="text-xs text-slate-500">
        {complemento
          ? 'Vai junto com o seu pedido, na mesma entrega, sem nova taxa. A loja aceita ou recusa em até 10 minutos; se aceitar, você paga só estes itens, num Pix à parte.'
          : 'A loja ainda não aceitou. Ela recebe o pedido novo na hora, e o prazo dela continua o mesmo.'}
      </p>

      {itens.length === 0 && complemento ? (
        <p className="text-sm text-slate-500">Escolha abaixo o que faltou.</p>
      ) : itens.length === 0 ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">
          Sem nenhum item, o pedido é cancelado.
          <button type="button" onClick={aoCancelarPedido} className="block mt-2 font-bold underline">Cancelar o pedido</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((i, k) => {
            const c = precoDe(i.tipo, i.id);
            return (
              <li key={`${i.tipo}:${i.id}`} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{i.nome}</p>
                  {c && <p className="text-xs text-slate-500">{brl(c.preco_unitario)} cada</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => mudarQtd(k, -1)} aria-label={`Menos ${i.nome}`} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center">
                    {i.quantidade === 1 ? <Trash2 className="w-4 h-4 text-red-600" /> : <Minus className="w-4 h-4" />}
                  </button>
                  <span className="w-7 text-center font-bold">{i.quantidade}</span>
                  <button type="button" onClick={() => mudarQtd(k, 1)} aria-label={`Mais ${i.nome}`} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {abrirCatalogo ? (
        <div className="rounded-xl border border-slate-200 p-3 max-h-72 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Produtos de {pedido.loja?.nome}</p>
          {!catalogo ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /> : catalogo.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum outro produto disponível agora.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {catalogo.map(prod => (
                <li key={`${prod.tipo}:${prod.id}`} className="flex items-center gap-2 py-2">
                  <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{prod.nome}</span>
                  <span className="text-sm font-semibold">{brl(prod.preco_unitario)}</span>
                  <button type="button" onClick={() => acrescentar(prod)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: ROXO }}>Pôr</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={verCatalogo} className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-dashed" style={{ color: ROXO, borderColor: '#C4B5FD' }}>
          + Adicionar produto desta loja
        </button>
      )}

      {itens.length > 0 && (
        <div className="border-t border-slate-100 pt-3 text-sm space-y-1">
          {erro && <p className="text-red-600 font-semibold">{erro}</p>}
          {cotacao && Number(cotacao.valor_entrega) > 0 && <p className="flex justify-between"><span className="text-slate-500">Entrega</span><span>{brl(cotacao.valor_entrega)}</span></p>}
          <p className="flex justify-between font-bold text-base">
            <span>{complemento ? 'Valor do complemento' : 'Novo total'}</span>
            <span>{cotacao ? brl(cotacao.total) : <Loader2 className="w-4 h-4 animate-spin inline" />}</span>
          </p>
          {!complemento && <p className="flex justify-between text-xs text-slate-400"><span>Antes</span><span>{brl(pedido.total)}</span></p>}
        </div>
      )}
      {aviso && <p className="text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3" role="alert">{aviso}</p>}

      {itens.length > 0 && (
        <button type="button" onClick={salvar} disabled={salvando || !cotacao || Boolean(erro)}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `${complemento ? 'Enviar complemento' : 'Salvar mudança'}${cotacao ? ` · ${brl(cotacao.total)}` : ''}`}
        </button>
      )}
    </div>
  );
}

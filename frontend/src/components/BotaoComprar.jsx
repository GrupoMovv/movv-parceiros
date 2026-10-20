import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingBag, Plus, Check } from 'lucide-react';
import apiPainel from '../services/apiPainel';
import { adicionarNaSacola, conflitaComSacola, lerSacola, useSacola } from '../pages/public/Pedido/sacola';

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Pergunta ao servidor se dá pra comprar esse item pelo site AGORA (loja
// ligou, aberta, não pausou, item com preço...). null = ainda carregando.
// `chave`: quando muda, pergunta de novo (ex.: o Fecha Mês acabou).
export function useDisponibilidade(tipo, id, chave) {
  const [disp, setDisp] = useState(null);
  useEffect(() => {
    if (!tipo || !id) return undefined;
    let vivo = true;
    apiPainel.get('/public/pedidos/disponibilidade', { params: { tipo, id } })
      .then(res => { if (vivo) setDisp(res.data); })
      .catch(() => { if (vivo) setDisp({ pode: false }); });
    return () => { vivo = false; };
  }, [tipo, id, chave]);
  return disp;
}

// Põe na sacola (confirmando se ela tinha outra loja). true = adicionou.
export function colocarNaSacola(disp, tipo, id, urlLoja) {
  return colocarItem(disp.loja, urlLoja, { tipo, id, nome: disp.item.nome, foto_url: disp.item.foto_url });
}

// O mesmo a partir dos dados que o card já tem. lojaApi = { id, nome, slug, catalogo }.
export function colocarItem(lojaApi, urlLoja, item) {
  const loja = { id: lojaApi.id, nome: lojaApi.nome, slug: lojaApi.slug, catalogo: lojaApi.catalogo, url: urlLoja };
  if (conflitaComSacola(loja)) {
    const outra = lerSacola()?.loja?.nome || 'outra loja';
    if (!window.confirm(`Seu pedido tem itens de ${outra}. Cada pedido é de uma loja só.\n\nComeçar um pedido novo com ${loja.nome}?`)) return false;
  }
  adicionarNaSacola(loja, item);
  return true;
}

// Botão principal dos cards na PÁGINA DA LOJA que vende pelo site: põe o item
// no pedido sem sair da página. "Comprar" sem pedido aberto desta loja,
// "+ Adicionar" com pedido aberto; embaixo, quantos desse item já estão no
// pedido. Promoção: 1 por pedido. Fica dentro de card que é <Link>: não navega.
//   loja: { id, nome, slug, catalogo } (da API de disponibilidade)
//   item: { tipo, id, nome, foto_url }
export function BotaoAdicionarCard({ loja, urlLoja, item, esgotado = false, className = '', style }) {
  const sacola = useSacola();
  const daLoja = Boolean(sacola && String(sacola.loja.id) === String(loja.id) && sacola.loja.catalogo === loja.catalogo);
  const qtd = daLoja ? (sacola.itens.find(i => i.tipo === item.tipo && String(i.id) === String(item.id))?.quantidade || 0) : 0;
  const promoNoPedido = item.tipo === 'promocao' && qtd > 0;
  const base = `w-full flex items-center justify-center gap-1 text-xs font-bold py-2 rounded-lg ${className}`;

  function adicionar(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!colocarItem(loja, urlLoja, item)) return;
    const total = (lerSacola()?.itens || []).reduce((n, i) => n + i.quantidade, 0);
    toast.success(`Adicionado ao pedido · ${total} ${total === 1 ? 'item' : 'itens'}`, { id: 'sacola' });
  }

  if (esgotado) return <span className={`${base} border border-slate-200 text-slate-400 bg-slate-100`}>Esgotado</span>;
  return (
    <div>
      {promoNoPedido ? (
        <span className={`${base} border border-emerald-500 text-emerald-600 bg-emerald-50`}><Check className="w-3.5 h-3.5" /> No pedido</span>
      ) : (
        <button type="button" onClick={adicionar} className={`${base} text-white`} style={{ backgroundColor: '#5B21B6', ...style }}>
          {daLoja ? <><Plus className="w-3.5 h-3.5" /> Adicionar</> : <><ShoppingBag className="w-3.5 h-3.5" /> Comprar</>}
        </button>
      )}
      {qtd > 0 && !promoNoPedido && (
        <p className="mt-1 text-center text-[11px] font-semibold text-emerald-600 flex items-center justify-center gap-1"><Check className="w-3 h-3" /> {qtd} no pedido</p>
      )}
    </div>
  );
}

// Botão "Comprar" ao lado do "Chamar no WhatsApp". Some quando a loja não
// vende pelo site (o WhatsApp continua). Mostra o preço que ESTA pessoa
// paga (calculado pelo servidor — é o mesmo que vai no pedido).
// disp: a página já consultou (ex.: botão no meio + barra fixa no celular).
export default function BotaoComprar({ tipo, id, urlLoja, className = '', style, compacto = false, mini = false, rotulo = 'Comprar', disp: dispPagina }) {
  const navigate = useNavigate();
  const proprio = useDisponibilidade(dispPagina === undefined ? tipo : null, dispPagina === undefined ? id : null);
  const disp = dispPagina === undefined ? proprio : dispPagina;
  if (!disp?.pode) return null;

  function comprar() {
    if (!colocarNaSacola(disp, tipo, id, urlLoja)) return;
    if (compacto) toast.success('Adicionado ao pedido');
    navigate('/pedido/finalizar');
  }

  return (
    <button type="button" onClick={comprar}
      className={`w-full flex items-center justify-center gap-2 font-bold text-white ${mini ? 'text-xs py-1.5 rounded-md' : compacto ? 'text-sm py-3 rounded-xl' : 'text-base py-4 rounded-xl'} ${className}`}
      style={{ backgroundColor: '#5B21B6', ...style }}>
      <ShoppingBag className={mini ? 'w-3 h-3' : 'w-5 h-5'} /> {rotulo}{mini ? '' : ` · ${brl(disp.item.preco_unitario)}`}
    </button>
  );
}

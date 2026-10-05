import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingBag } from 'lucide-react';
import apiPainel from '../services/apiPainel';
import { adicionarNaSacola, conflitaComSacola, lerSacola } from '../pages/public/Pedido/sacola';

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Pergunta ao servidor se dá pra comprar esse item pelo site AGORA (loja
// ligou, aberta, não pausou, item com preço...). null = ainda carregando.
export function useDisponibilidade(tipo, id) {
  const [disp, setDisp] = useState(null);
  useEffect(() => {
    if (!tipo || !id) return undefined;
    let vivo = true;
    apiPainel.get('/public/pedidos/disponibilidade', { params: { tipo, id } })
      .then(res => { if (vivo) setDisp(res.data); })
      .catch(() => { if (vivo) setDisp({ pode: false }); });
    return () => { vivo = false; };
  }, [tipo, id]);
  return disp;
}

// Põe na sacola (confirmando se ela tinha outra loja). true = adicionou.
export function colocarNaSacola(disp, tipo, id, urlLoja) {
  const loja = { id: disp.loja.id, nome: disp.loja.nome, slug: disp.loja.slug, catalogo: disp.loja.catalogo, url: urlLoja };
  if (conflitaComSacola(loja)) {
    const outra = lerSacola()?.loja?.nome || 'outra loja';
    if (!window.confirm(`Seu pedido tem itens de ${outra}. Cada pedido é de uma loja só.\n\nComeçar um pedido novo com ${loja.nome}?`)) return false;
  }
  adicionarNaSacola(loja, { tipo, id, nome: disp.item.nome, foto_url: disp.item.foto_url });
  return true;
}

// Botão "Comprar" ao lado do "Chamar no WhatsApp". Some quando a loja não
// vende pelo site (o WhatsApp continua). Mostra o preço que ESTA pessoa
// paga (calculado pelo servidor — é o mesmo que vai no pedido).
// disp: a página já consultou (ex.: botão no meio + barra fixa no celular).
export default function BotaoComprar({ tipo, id, urlLoja, className = '', style, compacto = false, mini = false, disp: dispPagina }) {
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
      <ShoppingBag className={mini ? 'w-3 h-3' : 'w-5 h-5'} /> Comprar{mini ? '' : ` · ${brl(disp.item.preco_unitario)}`}
    </button>
  );
}

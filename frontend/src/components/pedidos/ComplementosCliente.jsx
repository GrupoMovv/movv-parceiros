import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import apiPainel from '../../services/apiPainel';

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ROXO = '#5B21B6';

// B2: complementos do pedido, do lado do cliente. Aceito: o Pix só do valor
// do complemento (copia e cola e QR). Esperando a loja: dá para cancelar.
export default function ComplementosCliente({ pedido, setPedido }) {
  const [agindo, setAgindo] = useState(false);
  const lista = pedido.complementos || [];
  if (lista.length === 0) return null;

  async function cancelar() {
    setAgindo(true);
    try {
      const r = await apiPainel.post(`/public/pedidos/${pedido.id}/complementos/cancelar`);
      setPedido(r.data);
      toast.success('Complemento cancelado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos cancelar agora.');
    } finally {
      setAgindo(false);
    }
  }

  async function copiar(codigo) {
    try { await navigator.clipboard.writeText(codigo); toast.success('Código Pix copiado! Cole no app do banco.'); }
    catch { toast('Toque e segure o código para copiar.'); }
  }

  return (
    <div className="space-y-3">
      {lista.map(c => (
        <div key={c.id} className={`bg-white rounded-2xl p-5 ${c.status === 'aceito' ? 'border-2' : 'border border-slate-100'}`} style={c.status === 'aceito' ? { borderColor: ROXO } : undefined}>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Complemento</h2>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap">{c.status_texto}</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {c.itens.map((i, k) => <li key={k} className="flex justify-between gap-3"><span className="text-slate-700">{i.quantidade}x {i.nome}</span><span>{brl(i.subtotal)}</span></li>)}
          </ul>
          <p className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-slate-100"><span>Valor do complemento</span><span>{brl(c.total)}</span></p>
          {c.status === 'enviado' && (
            <>
              <p className="text-xs text-slate-500 mt-2">A loja tem até 10 minutos para responder. Vai na mesma entrega, sem nova taxa.</p>
              <button type="button" onClick={cancelar} disabled={agindo} className="mt-2 text-xs font-semibold text-slate-500 underline">
                {agindo ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Cancelar o complemento'}
              </button>
            </>
          )}
          {['recusado', 'expirado', 'cancelado'].includes(c.status) && (
            <p className="text-xs text-slate-500 mt-2">Nenhum valor a mais foi cobrado. O seu pedido continua normal.{c.resposta ? ` Motivo: ${c.resposta}` : ''}</p>
          )}
          {c.status === 'aceito' && c.pix_copia_e_cola && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-700">A loja aceitou. Pague <strong>só o complemento, {brl(c.total)}</strong>, num Pix à parte:</p>
              <button type="button" onClick={() => copiar(c.pix_copia_e_cola)} className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                <Copy className="w-4 h-4" /> Copiar Pix do complemento · {brl(c.total)}
              </button>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white p-2 rounded-xl border border-slate-200"><QRCodeSVG value={c.pix_copia_e_cola} size={148} level="M" /></div>
              </div>
            </div>
          )}
          {c.status === 'pago' && <p className="text-xs text-emerald-700 font-semibold mt-2">A loja confirmou o Pix do complemento.</p>}
        </div>
      ))}
      {Number(pedido.total_geral) !== Number(pedido.total) && (
        <p className="flex justify-between font-bold px-1" style={{ color: '#0F172A' }}><span>Total com o complemento</span><span>{brl(pedido.total_geral)}</span></p>
      )}
    </div>
  );
}

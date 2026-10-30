import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// B2: complementos ("esqueci um item") do pedido, do lado da loja. Aceitar ou
// recusar em 10 min; aceito, o cliente paga só o valor do complemento e a
// loja confirma esse Pix aqui. O "Pago" do pedido espera o complemento.
// executarComplemento(acao, corpo): rota com token (link) ou com login (painel).
export default function ComplementosLoja({ pedido, setPedido, executarComplemento, recarregar, grande = false }) {
  const [agindo, setAgindo] = useState(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const lista = pedido.complementos || [];
  const temEsperando = lista.some(c => c.status === 'enviado');

  useEffect(() => {
    if (!temEsperando) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [temEsperando]);

  if (lista.length === 0) return null;

  async function agir(acao) {
    setAgindo(acao);
    try {
      const dados = await executarComplemento(acao, { resposta: motivo || undefined });
      setPedido(dados);
      setRecusando(false); setMotivo('');
      if (dados.link_manual_cliente) toast('Não conseguimos avisar o cliente pelo WhatsApp. Avise você.', { icon: '⚠️' });
      else toast.success(acao === 'pago' ? 'Pix do complemento confirmado.' : 'Pronto! O cliente foi avisado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos atualizar agora.');
      if (err.response?.status === 409) recarregar?.();
    } finally {
      setAgindo(null);
    }
  }

  const txt = grande ? 'text-base' : 'text-sm';
  return (
    <div className="space-y-3 mt-3">
      {lista.map(c => {
        const aberto = ['enviado', 'aceito'].includes(c.status);
        const restante = c.responder_ate ? Math.max(0, Math.floor((new Date(c.responder_ate).getTime() - agora) / 1000)) : null;
        return (
          <div key={c.id} className={`rounded-xl border-2 p-3 ${aberto ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`${grande ? 'text-lg' : 'text-sm'} font-black text-violet-900`}>➕ Complemento · {brl(c.total)}</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 whitespace-nowrap">{c.status_texto}</span>
            </div>
            <p className="text-xs text-slate-500">Pedido às {hora(c.created_at)}. Vai na mesma entrega, sem nova taxa. Pix à parte, só deste valor.</p>
            <ul className={`mt-1 ${txt} text-slate-800`}>
              {c.itens.map((i, k) => <li key={k}><strong>{i.quantidade}x</strong> {i.nome} <span className="text-slate-500">· {brl(i.subtotal)}</span></li>)}
            </ul>
            {c.status === 'enviado' && restante !== null && (
              <p className={`mt-1 ${txt} font-bold ${restante < 120 ? 'text-red-600' : 'text-amber-700'}`}>
                {restante > 0 ? `Responda em ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : 'O prazo de resposta acabou.'}
              </p>
            )}
            {c.resposta && <p className="text-xs text-slate-500 mt-1">Motivo: {c.resposta}</p>}

            {c.acoes?.includes('aceitar') && !recusando && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => agir('aceitar')} disabled={Boolean(agindo)}
                  className={`${grande ? 'py-4 text-lg' : 'py-3 text-sm'} rounded-xl font-black text-white bg-emerald-600 disabled:opacity-60`}>
                  {agindo === 'aceitar' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Aceitar complemento'}
                </button>
                <button type="button" onClick={() => setRecusando(true)} disabled={Boolean(agindo)}
                  className={`${grande ? 'py-4 text-lg' : 'py-3 text-sm'} rounded-xl font-black text-red-700 border-2 border-red-200 bg-white`}>
                  Recusar
                </button>
              </div>
            )}
            {c.acoes?.includes('aceitar') && recusando && (
              <div className="mt-2 space-y-2">
                <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={200} placeholder="Motivo (opcional), ex.: acabou o produto"
                  aria-label="Motivo da recusa do complemento" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => agir('recusar')} disabled={Boolean(agindo)} className="py-2.5 rounded-xl text-sm font-black text-white bg-red-600 disabled:opacity-60">
                    {agindo === 'recusar' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Recusar complemento'}
                  </button>
                  <button type="button" onClick={() => { setRecusando(false); setMotivo(''); }} className="py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-300 bg-white">Voltar</button>
                </div>
              </div>
            )}
            {c.acoes?.includes('pago') && (
              <div className="mt-2 space-y-1">
                <button type="button" onClick={() => agir('pago')} disabled={Boolean(agindo)}
                  className={`w-full ${grande ? 'py-4 text-lg' : 'py-3 text-sm'} rounded-xl font-black text-white bg-blue-700 disabled:opacity-60`}>
                  {agindo === 'pago' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Pix do complemento caiu (${brl(c.total)})`}
                </button>
                <button type="button" onClick={() => agir('cancelar')} disabled={Boolean(agindo)} className="w-full text-xs font-semibold text-slate-500 underline py-1">
                  Cancelar o complemento
                </button>
              </div>
            )}
          </div>
        );
      })}
      {lista.some(c => ['enviado', 'aceito'].includes(c.status)) && pedido.status === 'aceito' && (
        <p className="text-xs text-slate-500">O botão “Pago” do pedido volta quando o complemento for resolvido, para ir tudo na mesma entrega.</p>
      )}
      {Number(pedido.total_geral) !== Number(pedido.total) && (
        <p className={`flex justify-between font-black ${grande ? 'text-lg' : 'text-base'} text-slate-900`}>
          <span>Total com o complemento</span><span>{brl(pedido.total_geral)}</span>
        </p>
      )}
    </div>
  );
}

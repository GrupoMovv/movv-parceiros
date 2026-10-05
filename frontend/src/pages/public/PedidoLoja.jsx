import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, XCircle, Truck, Store, AlertTriangle } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import api from '../../services/api';

const ROXO = '#5B21B6';
const PRETO = '#0F172A';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MOTIVOS_RECUSA = ['Fora da área de entrega', 'Produto em falta', 'Loja fechando agora'];
// Cancelar antes do Pix confirmado / depois de "Pago, saiu" (motivos diferentes)
const MOTIVOS_CANCELAR = ['Pix não caiu', 'Cliente desistiu', 'Produto em falta'];
const MOTIVOS_CANCELAR_PAGO = ['Marquei pago por engano', 'Não consegui entregar', 'Cliente desistiu'];

function telefoneBR(d) {
  const s = String(d || '').replace(/\D/g, '');
  return s.length === 11 ? `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}` : s.length === 10 ? `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}` : s;
}

// "Enviar para o entregador": WhatsApp sem destinatário (a loja escolhe o
// contato), só com o necessário pra entrega — SEM o link do pedido.
function linkEntregador(p) {
  const e = p.endereco || {};
  const cep = String(e.cep || '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  const linhas = [
    `🛵 Entrega — pedido #${p.id} (${p.loja_nome})`, '',
    `Cliente: ${p.cliente.nome}`,
    `Telefone: ${telefoneBR(p.cliente.whatsapp)}`,
    `Endereço: ${[`${e.endereco}, ${e.numero}`, e.complemento, e.bairro, e.cidade && `${e.cidade}/${e.estado}`, cep && `CEP ${cep}`].filter(Boolean).join(' — ')}`,
    e.referencia ? `Referência: ${e.referencia}` : null,
    // rota com um toque (Google Maps abre no app de mapa do celular)
    `Mapa: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([`${e.endereco}, ${e.numero}`, e.bairro, e.cidade && `${e.cidade} - ${e.estado}`, cep].filter(Boolean).join(', '))}`, '',
    'Itens:',
    ...p.itens.map(i => `${i.quantidade}x ${i.nome}`),
    `Total: ${brl(p.total)} (já pago no Pix)`,
    p.aviso_idade ? '⚠️ Bebida alcoólica: conferir documento (18+) na entrega.' : null,
  ].filter(l => l !== null);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(linhas.join('\n'))}`;
}

// /pedido-loja/:token — o link do aviso de WhatsApp da LOJA, sem login.
// No máximo 2 toques: Aceitar (ou Recusar) e "Pago, saiu". /pedido-loja/teste
// é o link do "Enviar aviso de teste" do painel.
export default function PedidoLoja() {
  const { token } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState(null);
  const [agindo, setAgindo] = useState(null);
  const [motivoAberto, setMotivoAberto] = useState(null); // 'recusar' | 'cancelar'
  const [motivo, setMotivo] = useState('');
  const [confirmoPago, setConfirmoPago] = useState(false);
  const [manualCliente, setManualCliente] = useState(null);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (token === 'teste') return;
    api.get(`/public/pedido-loja/${token}`).then(res => setPedido(res.data))
      .catch(err => setErro(err.response?.data?.error || 'Não conseguimos abrir o pedido agora.'));
  }, [token]);

  useEffect(() => {
    if (pedido?.status !== 'enviado') return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pedido?.status]);

  async function agir(acao) {
    setAgindo(acao);
    try {
      const res = await api.post(`/public/pedido-loja/${token}/${acao}`, {
        resposta: motivo || undefined,
        confirmo_cancelar_pago: acao === 'cancelar' && pedido.status === 'pago_saiu' ? confirmoPago : undefined,
      });
      setPedido(res.data);
      setMotivoAberto(null); setMotivo(''); setConfirmoPago(false);
      setManualCliente(res.data.link_manual_cliente);
      if (res.data.link_manual_cliente) toast('Não conseguimos avisar o cliente. Use o botão verde.', { icon: '⚠️' });
      else toast.success('Pronto! O cliente foi avisado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos atualizar agora.');
      if (err.response?.status === 409) api.get(`/public/pedido-loja/${token}`).then(r => setPedido(r.data)).catch(() => {});
    } finally {
      setAgindo(null);
    }
  }

  if (token === 'teste') {
    return (
      <Casca>
        <div className="text-center py-10">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
          <h1 className="text-xl font-bold mt-4" style={{ color: PRETO }}>O link abriu!</h1>
          <p className="text-sm text-slate-600 mt-2">Os avisos de pedido vão chegar no seu WhatsApp e abrir aqui, sem precisar de login.</p>
        </div>
      </Casca>
    );
  }
  if (erro) return <Casca><p className="text-center text-slate-600 py-16">{erro}</p></Casca>;
  if (!pedido) return <Casca><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div></Casca>;

  const restante = pedido.responder_ate ? Math.max(0, Math.floor((new Date(pedido.responder_ate).getTime() - agora) / 1000)) : null;
  const retirada = pedido.modo_recebimento === 'retirada';
  const depoisDoPago = pedido.status === 'pago_saiu';
  const e = pedido.endereco;

  return (
    <Casca>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{pedido.loja_nome}</p>
          <h1 className="text-2xl font-bold" style={{ color: PRETO }}>Pedido #{pedido.id}</h1>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">{pedido.status_texto}</span>
      </div>

      {pedido.status === 'enviado' && restante !== null && (
        <p className={`mt-3 text-sm font-semibold ${restante < 120 ? 'text-red-600' : 'text-amber-700'}`}>
          {restante > 0 ? `Responda em ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : 'O prazo de resposta acabou.'}
        </p>
      )}

      {pedido.aviso_idade && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> Bebida alcoólica: confira a idade (18+) do cliente na {retirada ? 'retirada' : 'entrega'}.
        </div>
      )}

      {manualCliente && (
        <a href={manualCliente} target="_blank" rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white bg-emerald-600">
          <WhatsappLogo size={20} weight="fill" /> Avisar o cliente no WhatsApp
        </a>
      )}

      <Bloco titulo="Itens">
        <ul className="space-y-2 text-sm">
          {pedido.itens.map((i, k) => (
            <li key={k} className="flex justify-between gap-3">
              <span style={{ color: PRETO }}><strong>{i.quantidade}x</strong> {i.nome}</span>
              <span className="text-slate-600 whitespace-nowrap">{brl(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 mt-3 pt-3 text-sm space-y-1">
          {Number(pedido.valor_entrega) > 0 && <p className="flex justify-between"><span className="text-slate-500">Entrega</span><span>{brl(pedido.valor_entrega)}</span></p>}
          <p className="flex justify-between font-bold text-base" style={{ color: PRETO }}><span>Total (Pix para você)</span><span>{brl(pedido.total)}</span></p>
        </div>
      </Bloco>

      <Bloco titulo={retirada ? 'Retirada na loja' : 'Entrega'}>
        <p className="text-sm font-semibold" style={{ color: PRETO }}>{pedido.cliente.nome}</p>
        {e && (
          <p className="text-sm text-slate-700 mt-1">
            {e.endereco}, {e.numero}{e.complemento ? ` — ${e.complemento}` : ''}<br />
            {e.bairro}{e.cidade ? ` · ${e.cidade}/${e.estado}` : ''} · CEP {e.cep}
            {e.referencia && <><br /><span className="text-slate-500">Referência: {e.referencia}</span></>}
          </p>
        )}
        {pedido.observacao && <p className="text-sm text-slate-600 mt-2">📝 "{pedido.observacao}"</p>}
        <a href={pedido.cliente.link_whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-emerald-700">
          <WhatsappLogo size={18} weight="fill" /> Chamar o cliente
        </a>
      </Bloco>

      {pedido.status === 'pago_saiu' && !retirada && (
        <a href={linkEntregador(pedido)} target="_blank" rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold border-2 border-emerald-600 text-emerald-700">
          <Truck className="w-5 h-5" /> Enviar para o entregador
        </a>
      )}

      {pedido.resposta && <p className="mt-4 text-sm text-slate-600">Recado: {pedido.resposta}</p>}

      {motivoAberto ? (
        <Bloco titulo={motivoAberto === 'recusar' ? 'Por que vai recusar?' : 'Por que vai cancelar?'}>
          <div className="flex flex-wrap gap-2">
            {(motivoAberto === 'recusar' ? MOTIVOS_RECUSA : depoisDoPago ? MOTIVOS_CANCELAR_PAGO : MOTIVOS_CANCELAR).map(m => (
              <button key={m} type="button" onClick={() => setMotivo(m)}
                className={`text-xs font-semibold px-3 py-2 rounded-full border ${motivo === m ? 'border-violet-700 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600'}`}>{m}</button>
            ))}
          </div>
          <textarea value={motivo} onChange={ev => setMotivo(ev.target.value.slice(0, 200))} rows={2} placeholder="Ou escreva aqui (o cliente vê)"
            className="mt-3 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          {depoisDoPago && motivoAberto === 'cancelar' && (
            // Confirmação extra: o cliente já recebeu "a loja confirmou seu Pix"
            <label className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900 cursor-pointer">
              <input type="checkbox" checked={confirmoPago} onChange={ev => setConfirmoPago(ev.target.checked)} className="mt-0.5" />
              <span>Entendi: o cliente já recebeu o aviso de que o Pix foi confirmado. Vou combinar a devolução com ele.</span>
            </label>
          )}
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => agir(motivoAberto)}
              disabled={Boolean(agindo) || (depoisDoPago && motivoAberto === 'cancelar' && (!confirmoPago || !motivo.trim()))}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 disabled:opacity-60">
              {agindo ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (motivoAberto === 'recusar' ? 'Recusar pedido' : 'Cancelar pedido')}
            </button>
            <button type="button" onClick={() => { setMotivoAberto(null); setMotivo(''); setConfirmoPago(false); }} className="px-4 py-3 rounded-xl font-semibold text-slate-600 border border-slate-200">Voltar</button>
          </div>
        </Bloco>
      ) : (
        <div className="mt-6 space-y-3">
          {pedido.acoes.includes('aceitar') && (
            <Botao onClick={() => agir('aceitar')} carregando={agindo === 'aceitar'} cor="#059669" icone={CheckCircle2}>Aceitar pedido</Botao>
          )}
          {pedido.acoes.includes('recusar') && (
            <button type="button" onClick={() => setMotivoAberto('recusar')} className="w-full py-3 rounded-xl font-bold text-red-700 border-2 border-red-200 flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" /> Recusar
            </button>
          )}
          {pedido.acoes.includes('pago_saiu') && (
            <>
              <p className="text-sm text-slate-600">O cliente recebeu sua chave Pix. Confira no seu banco e toque quando o Pix cair:</p>
              <Botao onClick={() => agir('pago_saiu')} carregando={agindo === 'pago_saiu'} cor={ROXO} icone={retirada ? Store : Truck}>
                {retirada ? 'Pago, pode retirar' : 'Pago, saiu para entrega'}
              </Botao>
            </>
          )}
          {pedido.acoes.includes('cancelar') && (
            <button type="button" onClick={() => setMotivoAberto('cancelar')} className="w-full text-sm font-semibold text-slate-500 underline py-2">Cancelar este pedido</button>
          )}
          {pedido.acoes.length === 0 && <p className="text-sm text-slate-500 text-center">Este pedido já foi encerrado.</p>}
        </div>
      )}
    </Casca>
  );
}

function Casca({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <p className="text-xs font-bold tracking-wide mb-4" style={{ color: ROXO }}>IUB MAIS+ · Pedido pelo site</p>
        {children}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <div className="mt-4 bg-white rounded-2xl border border-slate-100 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{titulo}</h2>
      {children}
    </div>
  );
}

function Botao({ onClick, carregando, cor, icone: Icone, children }) {
  return (
    <button type="button" onClick={onClick} disabled={carregando}
      className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-60"
      style={{ backgroundColor: cor }}>
      {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icone className="w-5 h-5" />} {children}
    </button>
  );
}

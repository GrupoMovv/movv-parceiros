import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ChevronLeft, Copy, CheckCircle2, AlertTriangle, Truck, Store } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import apiPainel from '../../../services/apiPainel';
import { COR_STATUS } from './MeusPedidos';

const NAVY = '#0B1F3A';
const ROXO = '#5B21B6';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ROTULO_PIX = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' };
const ABERTOS = ['enviado', 'aceito', 'pago_saiu'];

function hora(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
}

function linkLoja(p, texto) {
  const d = String(p.loja?.whatsapp || '').replace(/\D/g, '');
  return d ? `https://api.whatsapp.com/send?phone=55${d}&text=${encodeURIComponent(texto)}` : null;
}

// /meu/pedidos/:id — acompanhar um pedido pelo site. Mostra o Pix depois do
// aceite (com copiar), deixa cancelar só enquanto a loja não aceitou,
// "Recebi meu pedido" depois de "saiu", e sempre o atalho pra chamar a loja.
// Atualiza sozinho enquanto o pedido está em andamento.
export default function MeuPedidoDetalhe() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [erro, setErro] = useState(null);
  const [agindo, setAgindo] = useState(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  function carregar() {
    apiPainel.get(`/public/pedidos/${id}`).then(r => setP(r.data))
      .catch(err => setErro(err.response?.status === 404 ? 'Pedido não encontrado.' : 'Não conseguimos carregar o pedido.'));
  }
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!p || !ABERTOS.includes(p.status)) return undefined;
    const t = setInterval(carregar, 20000);
    return () => clearInterval(t);
  }, [p?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acao(nome) {
    setAgindo(nome);
    try {
      const r = await apiPainel.post(`/public/pedidos/${id}/${nome}`);
      setP(r.data);
      setConfirmandoCancelar(false);
      toast.success(nome === 'recebi' ? 'Obrigado! Pedido concluído.' : 'Pedido cancelado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos atualizar agora.');
      carregar();
    } finally {
      setAgindo(null);
    }
  }

  async function copiarPix() {
    try { await navigator.clipboard.writeText(p.pix_chave); toast.success('Chave Pix copiada!'); }
    catch { toast('Toque e segure a chave para copiar.'); }
  }

  async function copiarCopiaECola() {
    try { await navigator.clipboard.writeText(p.pix_copia_e_cola); toast.success('Código Pix copiado! Cole no app do banco.'); }
    catch { toast('Toque e segure o código para copiar.'); }
  }

  if (erro) return <p className="text-center text-sm text-slate-500 py-12">{erro} <Link to="/meu/pedidos" className="underline">Ver meus pedidos</Link></p>;
  if (!p) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const [fundo, texto] = COR_STATUS[p.status] || COR_STATUS.cancelado;
  const retirada = p.modo_recebimento === 'retirada';
  const falarComLoja = linkLoja(p, `Olá! Sobre o meu pedido #${p.id} pelo IUB MAIS+.`);
  const etapas = [
    { nome: 'Pedido enviado', em: p.created_at },
    { nome: 'Aceito pela loja', em: p.aceito_em },
    { nome: retirada ? 'Pago, pode retirar' : 'Pago, saiu para entrega', em: p.pago_saiu_em },
    { nome: retirada ? 'Retirado' : 'Entregue', em: p.entregue_em },
  ];

  return (
    <div className="space-y-4">
      <Link to="/meu/pedidos" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: ROXO }}>
        <ChevronLeft className="w-4 h-4" /> Meus pedidos
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{p.loja?.nome}</p>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>Pedido #{p.id}</h1>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: fundo, color: texto }}>{p.status_texto}</span>
        </div>

        {['recusado', 'cancelado', 'expirado'].includes(p.status) ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {p.status === 'expirado' && 'A loja não respondeu em 10 minutos. Nenhum pagamento foi feito.'}
            {p.status === 'recusado' && 'A loja não pôde atender este pedido. Nenhum pagamento foi feito.'}
            {p.status === 'cancelado' && (p.encerrado_por === 'cliente' ? 'Você cancelou este pedido.' : p.pago_saiu_em ? 'A loja cancelou depois de confirmar seu Pix. Fale com ela para combinar a devolução.' : 'Este pedido foi cancelado. Se você já pagou o Pix, fale com a loja.')}
            {p.resposta && <p className="mt-1 text-slate-500">Motivo: {p.resposta}</p>}
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {etapas.map(e => (
              <li key={e.nome} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${e.em ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span className={e.em ? 'text-slate-800 font-medium' : 'text-slate-400'}>{e.nome}</span>
                {e.em && <span className="text-xs text-slate-400 ml-auto">{hora(e.em)}</span>}
              </li>
            ))}
          </ol>
        )}
        {p.status === 'enviado' && <p className="mt-3 text-xs text-slate-500">A loja tem até 10 minutos para aceitar. A chave Pix chega no seu WhatsApp e aparece aqui.</p>}
      </div>

      {p.link_manual_loja && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-900">Não conseguimos avisar a loja pelo WhatsApp. Avise você, com um toque:</p>
          <a href={p.link_manual_loja} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white bg-emerald-600">
            <WhatsappLogo size={20} weight="fill" /> Avisar a loja no WhatsApp
          </a>
        </div>
      )}

      {p.pix_chave && (
        <div className="bg-white rounded-2xl border-2 p-5" style={{ borderColor: ROXO }}>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Pague no Pix da loja</h2>
          <p className="text-2xl font-extrabold mt-2" style={{ color: NAVY }}>{brl(p.total)}</p>
          <p className="text-sm text-slate-600 mt-2">{ROTULO_PIX[p.pix_tipo] || 'Chave'}: <strong className="break-all select-all">{p.pix_chave}</strong></p>
          {p.pix_nome_recebedor && <p className="text-sm text-slate-600">Nome: {p.pix_nome_recebedor}</p>}
          {p.status === 'aceito' && p.pix_copia_e_cola && (
            <div className="mt-4 space-y-3">
              <button type="button" onClick={copiarCopiaECola} className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                <Copy className="w-4 h-4" /> Copiar Pix copia e cola · {brl(p.total)}
              </button>
              <p className="text-xs text-slate-500">No app do banco, escolha <strong>Pix copia e cola</strong> e cole. O valor já vai preenchido.</p>
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="bg-white p-2 rounded-xl border border-slate-200"><QRCodeSVG value={p.pix_copia_e_cola} size={168} level="M" /></div>
                <p className="text-xs text-slate-500 text-center">Ou leia o QR com o app do banco em outro celular.</p>
              </div>
              <button type="button" onClick={copiarPix} className="text-xs font-semibold underline" style={{ color: ROXO }}>
                Copiar só a chave Pix
              </button>
            </div>
          )}
          {p.status === 'aceito' && !p.pix_copia_e_cola && (
            <button type="button" onClick={copiarPix} className="mt-3 flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              <Copy className="w-4 h-4" /> Copiar chave Pix
            </button>
          )}
          <p className="text-xs text-slate-500 mt-3">
            {p.status === 'aceito'
              ? 'Confira o nome antes de pagar. A loja só prepara o pedido depois de confirmar o Pix. Prazo: 2 horas.'
              : 'A loja já confirmou o seu Pix.'}
          </p>
        </div>
      )}

      {p.status === 'pago_saiu' && (
        <button type="button" onClick={() => acao('recebi')} disabled={Boolean(agindo)}
          className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: '#059669' }}>
          {agindo === 'recebi' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {retirada ? 'Já retirei meu pedido' : 'Recebi meu pedido'}
        </button>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Itens</h2>
        <ul className="space-y-1.5 text-sm">
          {p.itens.map(i => (
            <li key={i.id} className="flex justify-between gap-3"><span className="text-slate-700">{i.quantidade}x {i.nome}</span><span>{brl(i.subtotal)}</span></li>
          ))}
        </ul>
        <div className="border-t border-slate-100 mt-3 pt-3 text-sm space-y-1">
          {Number(p.valor_entrega) > 0 && <p className="flex justify-between"><span className="text-slate-500">Entrega</span><span>{brl(p.valor_entrega)}</span></p>}
          <p className="flex justify-between font-bold" style={{ color: NAVY }}><span>Total</span><span>{brl(p.total)}</span></p>
        </div>
        <p className="text-sm text-slate-600 mt-4 flex items-start gap-2">
          {retirada ? <Store className="w-4 h-4 mt-0.5" /> : <Truck className="w-4 h-4 mt-0.5" />}
          <span>{retirada ? 'Retirada na loja' : [`${p.endereco}, ${p.numero}`, p.complemento, p.bairro].filter(Boolean).join(' — ')}</span>
        </p>
        {p.aviso_idade && <p className="text-xs text-amber-800 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Bebida alcoólica: tenha um documento com foto na {retirada ? 'retirada' : 'entrega'}.</p>}
        {p.observacao && <p className="text-xs text-slate-500 mt-2">Seu recado: "{p.observacao}"</p>}
      </div>

      {falarComLoja && (
        <a href={falarComLoja} target="_blank" rel="noreferrer"
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold ${p.status === 'expirado' ? 'text-white bg-emerald-600' : 'border-2 border-emerald-600 text-emerald-700'}`}>
          <WhatsappLogo size={20} weight="fill" /> Chamar a loja no WhatsApp
        </a>
      )}

      {p.status === 'enviado' && (
        confirmandoCancelar ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-900">Cancelar o pedido #{p.id}? A loja ainda não aceitou, então nenhum pagamento foi feito.</p>
            <div className="flex gap-3 mt-3">
              <button type="button" onClick={() => acao('cancelar')} disabled={Boolean(agindo)} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 disabled:opacity-60">
                {agindo === 'cancelar' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sim, cancelar'}
              </button>
              <button type="button" onClick={() => setConfirmandoCancelar(false)} className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 border border-slate-200 bg-white">Voltar</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmandoCancelar(true)} className="w-full text-sm font-semibold text-slate-500 underline py-2">Cancelar pedido</button>
        )
      )}
      {p.status === 'aceito' && <p className="text-xs text-center text-slate-400">Para cancelar depois do aceite, chame a loja no WhatsApp.</p>}
    </div>
  );
}

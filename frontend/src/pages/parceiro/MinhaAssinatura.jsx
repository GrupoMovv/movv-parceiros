import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, CreditCard, QrCode, CalendarClock, Gift, AlertTriangle } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import ModalPix from '../../components/parceiro/assinatura/ModalPix';
import { formatarBRL, dataBR, diasAte, mensagemErro, ROTULO_STATUS, NOME_BANDEIRA } from '../../components/parceiro/assinatura/assinaturaUtils';

const ROTULO_PAGAMENTO = { aprovado: '✅ Pago', rejeitado: '❌ Recusado', reembolsado: '↩️ Estornado' };

// /parceiro/painel/minha-assinatura — plano atual, status (trial com dias
// restantes / ativa / cancelada), forma de pagamento, próxima cobrança,
// últimos 6 pagamentos, renovar PIX e cancelar.
export default function MinhaAssinatura() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [modalPix, setModalPix] = useState(null); // 'renovar' | 'pendente'

  const carregar = useCallback(() => {
    apiParceiro.get('/parceiro/assinatura/minha')
      .then(r => { setDados(r.data); setErro(false); })
      .catch(() => setErro(true));
  }, []);
  useEffect(carregar, [carregar]);

  async function cancelar() {
    setCancelando(true);
    try {
      const r = await apiParceiro.post('/parceiro/assinatura/cancelar', {}, { timeout: 30000 });
      toast.success(r.data.acesso_ate ? `Assinatura cancelada. Benefícios até ${dataBR(r.data.acesso_ate)}.` : 'Assinatura cancelada.');
      setConfirmarCancelamento(false);
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível cancelar agora.'));
    } finally {
      setCancelando(false);
    }
  }

  if (erro) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500 text-sm">Não foi possível carregar sua assinatura.</p>
        <button type="button" onClick={carregar} className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Tentar de novo</button>
      </div>
    );
  }
  if (!dados) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;

  const a = dados.assinatura;
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold" style={{ color: PRETO }}>Minha assinatura</h1>

      {dados.cortesia_interna && (
        <Cartao>
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${DOURADO}26` }}>
              <Gift className="w-5 h-5" style={{ color: '#92700C' }} />
            </span>
            <div>
              <p className="font-black" style={{ color: PRETO }}>Cortesia interna</p>
              <p className="text-sm text-slate-600 mt-1">
                Sua loja tem o plano <strong>{dados.plano_atual_nome}</strong> oferecido pelo IUB MAIS, <strong>sem cobrança</strong> e sem data pra acabar.
              </p>
            </div>
          </div>
        </Cartao>
      )}

      {!dados.cortesia_interna && !a && (
        <Cartao>
          <p className="font-bold" style={{ color: PRETO }}>Você está no plano {dados.plano_atual_nome || 'Grátis'}</p>
          <p className="text-sm text-slate-500 mt-1">Assine um plano pago pra aparecer mais no marketplace — no cartão tem desconto e dias grátis pra testar.</p>
          <Link to="/parceiro/painel/planos" className="inline-block mt-4 text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Ver planos</Link>
        </Cartao>
      )}

      {!dados.cortesia_interna && a && (
        <>
          <Cartao>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Plano</p>
                <p className="text-xl font-black mt-0.5" style={{ color: PRETO }}>{a.plano_nome}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: ROXO }}>{formatarBRL(a.valor_mensal)}/mês</p>
              </div>
              <StatusBadge assinatura={a} />
            </div>

            <MensagemStatus assinatura={a} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <Info icone={a.metodo === 'pix' ? QrCode : CreditCard} rotulo="Forma de pagamento">
                {a.metodo === 'pix'
                  ? 'PIX mensal'
                  : `${NOME_BANDEIRA[a.cartao_bandeira] || 'Cartão'}${a.cartao_final ? ` final ${a.cartao_final}` : ''} (recorrente)`}
              </Info>
              <Info icone={CalendarClock} rotulo={rotuloData(a)}>{dataBR(dataPrincipal(a))}</Info>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              {a.pode_renovar_pix && !dados.pix_pendente && (
                <button type="button" onClick={() => setModalPix('renovar')} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                  Pagar próximo mês (PIX)
                </button>
              )}
              {dados.pix_pendente && (
                <button type="button" onClick={() => setModalPix('pendente')} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                  Ver QR Code do PIX
                </button>
              )}
              <Link to="/parceiro/painel/planos" className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                {a.pode_cancelar ? 'Ver planos' : 'Assinar de novo'}
              </Link>
              {a.pode_cancelar && (
                <button type="button" onClick={() => setConfirmarCancelamento(true)} className="text-sm font-semibold px-5 py-2.5 rounded-xl text-red-600 hover:bg-red-50">
                  Cancelar assinatura
                </button>
              )}
            </div>
          </Cartao>

          <Cartao>
            <p className="font-bold" style={{ color: PRETO }}>Histórico de pagamentos</p>
            {dados.pagamentos.length === 0 ? (
              <p className="text-sm text-slate-400 mt-2">Nenhum pagamento ainda{a.status === 'trial' ? (a.credito ? ' neste plano — os dias já pagos do plano anterior estão valendo.' : ' — você está no trial grátis.') : '.'}</p>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {dados.pagamentos.map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-slate-500">{dataBR(p.data_pagamento || p.created_at)}</span>
                    <span className="text-slate-500">{p.metodo === 'pix' ? 'PIX' : 'Cartão'}</span>
                    <strong style={{ color: PRETO }}>{formatarBRL(p.valor)}</strong>
                    <span className="text-xs">{ROTULO_PAGAMENTO[p.status] || p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </>
      )}

      {confirmarCancelamento && a && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center">
            <AlertTriangle className="w-9 h-9 mx-auto text-amber-500" />
            <h2 className="font-black text-lg mt-2" style={{ color: PRETO }}>Cancelar assinatura?</h2>
            <p className="text-sm text-slate-600 mt-2">
              {a.metodo === 'cartao_recorrente' ? 'Não haverá mais cobranças no cartão. ' : ''}
              {a.acesso_ate && diasAte(a.acesso_ate) > 0
                ? <>Os benefícios do <strong>{a.plano_nome}</strong> continuam até <strong>{dataBR(a.acesso_ate)}</strong>; depois a loja volta pro Grátis (seus produtos continuam no ar).</>
                : 'A loja segue no plano Grátis (seus produtos continuam no ar).'}
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" onClick={cancelar} disabled={cancelando}
                className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {cancelando && <Loader2 className="w-4 h-4 animate-spin" />} Sim, cancelar
              </button>
              <button type="button" onClick={() => setConfirmarCancelamento(false)} disabled={cancelando} className="text-sm font-semibold py-3 rounded-xl border border-slate-200">
                Manter assinatura
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPix && a && (
        <ModalPix
          plano={a.plano}
          planoNome={a.plano_nome}
          valor={modalPix === 'pendente' ? dados.pix_pendente.valor : a.valor_mensal}
          modo={a.status === 'ativa' ? 'renovar' : 'nova'}
          pixInicial={modalPix === 'pendente' ? dados.pix_pendente : null}
          onFechar={() => { setModalPix(null); carregar(); }}
        />
      )}
    </div>
  );
}

function dataPrincipal(a) {
  if (a.status === 'trial') return a.trial_ate;
  if (a.status === 'cancelada' || a.status === 'vencida') return a.acesso_ate;
  if (a.metodo === 'cartao_recorrente') return a.data_proxima_cobranca;
  return a.acesso_ate;
}
function rotuloData(a) {
  if (a.status === 'trial') return 'Primeira cobrança';
  if (a.status === 'cancelada') return 'Benefícios até';
  if (a.status === 'vencida') return 'Venceu em';
  if (a.status === 'aguardando_pagamento') return 'Aguardando pagamento';
  return a.metodo === 'cartao_recorrente' ? 'Próxima cobrança' : 'Plano ativo até';
}

function StatusBadge({ assinatura: a }) {
  const r = ROTULO_STATUS[a.status] || ROTULO_STATUS.ativa;
  const dias = a.trial_dias_restantes != null ? `${a.trial_dias_restantes} ${a.trial_dias_restantes === 1 ? 'dia' : 'dias'}` : '';
  const texto = a.status === 'trial' && a.trial_dias_restantes != null
    ? (a.credito ? `Já pago — ${dias}` : `Trial — ${dias} ${a.trial_dias_restantes === 1 ? 'restante' : 'restantes'}`)
    : r.texto;
  return <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: r.cor, backgroundColor: r.fundo }}>{texto}</span>;
}

// Textos combinados por caso (trial / cartão ativo / PIX ativo / cancelada).
function MensagemStatus({ assinatura: a }) {
  let texto = null;
  if (a.status === 'trial' && a.credito) {
    texto = `Plano trocado: os dias que você já tinha pago no plano anterior foram aproveitados. Primeira cobrança do ${a.plano_nome} (${formatarBRL(a.valor_mensal)}) em ${dataBR(a.trial_ate)}.`;
  } else if (a.status === 'trial') {
    const d = diasAte(a.trial_ate);
    texto = `Você está no trial gratuito. Primeira cobrança de ${formatarBRL(a.valor_mensal)} ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`} (${dataBR(a.trial_ate)}). Cancele antes e nada é cobrado.`;
  } else if (a.status === 'ativa' && a.metodo === 'cartao_recorrente') {
    const dia = a.data_proxima_cobranca ? new Date(a.data_proxima_cobranca).toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' }) : null;
    texto = `Cobrado automaticamente${dia ? ` todo dia ${dia} do mês` : ' todo mês'} no cartão. Cancele quando quiser.`;
  } else if (a.status === 'ativa' && a.metodo === 'pix') {
    const d = diasAte(a.acesso_ate);
    texto = a.pode_renovar_pix
      ? `Seu plano vence em ${d} ${d === 1 ? 'dia' : 'dias'}. Pague o próximo mês pelo PIX pra não perder os benefícios.`
      : `Próximo PIX em ${Math.max(0, d - 7)} dias (liberado 7 dias antes do vencimento). Vamos te lembrar!`;
  } else if (a.status === 'aguardando_pagamento') {
    texto = a.metodo === 'pix' ? 'Assim que o PIX for pago, o plano é ativado na hora.' : 'Processando a primeira cobrança no cartão.';
  } else if (a.status === 'cancelada') {
    texto = a.acesso_ate && diasAte(a.acesso_ate) > 0
      ? `Assinatura cancelada — sem novas cobranças. Os benefícios continuam até ${dataBR(a.acesso_ate)}.`
      : 'Assinatura cancelada.';
  } else if (a.status === 'vencida') {
    texto = 'O período pago terminou e a loja voltou pro plano Grátis. Assine de novo quando quiser.';
  } else if (a.status === 'pausada') {
    texto = 'Assinatura pausada no Mercado Pago. Fale com a gente se precisar de ajuda.';
  }
  return texto ? <p className="text-sm text-slate-600 mt-4 rounded-xl bg-slate-50 px-4 py-3">{texto}</p> : null;
}

function Info({ icone: Icone, rotulo, children }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 px-4 py-3">
      <Icone className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: PRETO }}>{children}</p>
      </div>
    </div>
  );
}

function Cartao({ children }) {
  return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">{children}</div>;
}

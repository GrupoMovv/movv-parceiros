import { useEffect, useRef, useState } from 'react';
import { X, Loader2, CreditCard, CheckCircle2, ShieldCheck } from 'lucide-react';
import apiParceiro from '../../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../../../pages/public/Marketplace/theme';
import { formatarBRL, dataBR, mensagemErro, carregarSdkMercadoPago } from './assinaturaUtils';

const CONTAINER_ID = 'iubmais-card-brick';

// Modal do cartão recorrente: confirma (termos) -> formulário do cartão
// (Card Payment Brick do Mercado Pago — número/CVV ficam nos iframes do
// MP, a gente só recebe o token) -> POST /criar-cartao-recorrente ->
// "7 dias grátis ativados".
export default function ModalCartao({ plano, planoNome, valor, trial, trialDias, publicKey, emailPadrao, onFechar }) {
  const [fase, setFase] = useState('confirmar'); // confirmar | cartao | enviando | sucesso | erro
  const [aceito, setAceito] = useState(false);
  const [carregandoBrick, setCarregandoBrick] = useState(true);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const controllerRef = useRef(null);
  const primeiraCobranca = new Date(Date.now() + (trial ? trialDias : 0) * 864e5);

  function desmontarBrick() {
    try { controllerRef.current?.unmount(); } catch { /* já desmontado */ }
    controllerRef.current = null;
  }
  useEffect(() => desmontarBrick, []);

  useEffect(() => {
    if (fase !== 'cartao') return undefined;
    let cancelado = false;
    setCarregandoBrick(true);
    (async () => {
      try {
        const MercadoPago = await carregarSdkMercadoPago();
        if (cancelado) return;
        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        controllerRef.current = await mp.bricks().create('cardPayment', CONTAINER_ID, {
          initialization: { amount: Number(valor), payer: { email: emailPadrao || '' } },
          customization: {
            // Débito não serve pra cobrança recorrente; parcelamento não se
            // aplica a mensalidade.
            paymentMethods: { maxInstallments: 1, minInstallments: 1, types: { excluded: ['debit_card'] } },
            visual: {
              hidePaymentButton: false,
              texts: { formTitle: 'Cartão de crédito', formSubmit: trial ? `Começar ${trialDias} dias grátis` : `Assinar por ${formatarBRL(valor)}/mês` },
              style: { theme: 'default', customVariables: { baseColor: ROXO, borderRadiusLarge: '16px' } },
            },
          },
          callbacks: {
            onReady: () => { if (!cancelado) setCarregandoBrick(false); },
            onError: e => console.error('[Bricks MP]', e),
            onSubmit: (dados, adicionais) => enviar(dados, adicionais),
          },
        });
      } catch (err) {
        if (!cancelado) { setErro(err.message || 'Não foi possível carregar o formulário do cartão.'); setFase('erro'); }
      }
    })();
    return () => { cancelado = true; desmontarBrick(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // O Brick espera uma Promise: resolve = ok. Em erro nós mesmos trocamos de
  // tela (mensagem nossa, mais clara que a genérica do Brick).
  async function enviar(dados, adicionais) {
    setFase('enviando');
    try {
      const r = await apiParceiro.post('/parceiro/assinatura/criar-cartao-recorrente', {
        plano,
        card_token: dados.token,
        payer_email: dados.payer?.email || emailPadrao,
        payment_method_id: dados.payment_method_id,
        ultimos4: adicionais?.lastFourDigits,
      }, { timeout: 45000 });
      setResultado(r.data);
      setFase('sucesso');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível concluir a assinatura.'));
      setFase('erro');
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
        {fase !== 'sucesso' && fase !== 'enviando' && (
          <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 z-10">
            <X className="w-4 h-4" />
          </button>
        )}

        {fase === 'confirmar' && (
          <div>
            <CreditCard className="w-8 h-8" style={{ color: ROXO }} />
            <h2 className="font-black text-lg mt-2" style={{ color: PRETO }}>Assinar com cartão</h2>
            {trial && (
              <p className="inline-block mt-2 text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: `${DOURADO}33`, color: '#7A5E00' }}>
                🎁 {trialDias} dias GRÁTIS pra testar
              </p>
            )}
            <div className="rounded-2xl bg-slate-50 p-4 mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Plano</span><strong style={{ color: PRETO }}>{planoNome}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Mensalidade</span><strong style={{ color: ROXO }}>{formatarBRL(valor)}/mês</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Primeira cobrança</span><strong style={{ color: PRETO }}>{trial ? dataBR(primeiraCobranca) : 'agora'}</strong></div>
            </div>
            <label className="flex items-start gap-2 mt-4 text-xs text-slate-600">
              <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} className="rounded mt-0.5" />
              {trial
                ? `Li e aceito: ${trialDias} dias grátis e depois ${formatarBRL(valor)} por mês no cartão, renovação automática. Cancele quando quiser em Minha Assinatura — cancelando antes de ${dataBR(primeiraCobranca)}, nada é cobrado.`
                : `Li e aceito: ${formatarBRL(valor)} por mês no cartão, renovação automática. Cancele quando quiser em Minha Assinatura.`}
            </label>
            <button type="button" onClick={() => setFase('cartao')} disabled={!aceito}
              className="w-full mt-5 text-sm font-bold py-3.5 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>
              Continuar pro cartão
            </button>
          </div>
        )}

        {fase === 'cartao' && (
          <div>
            <h2 className="font-black text-lg pr-10" style={{ color: PRETO }}>Dados do cartão</h2>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Processado pelo Mercado Pago. O IUB MAIS não vê nem guarda o número do cartão.
            </p>
            {carregandoBrick && (
              <div className="py-10 text-center"><Loader2 className="w-7 h-7 mx-auto animate-spin" style={{ color: ROXO }} /></div>
            )}
            <div id={CONTAINER_ID} className="mt-3" />
          </div>
        )}

        {fase === 'enviando' && (
          <div className="text-center py-12">
            <Loader2 className="w-9 h-9 mx-auto animate-spin" style={{ color: ROXO }} />
            <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>Ativando sua assinatura...</p>
          </div>
        )}

        {fase === 'sucesso' && resultado && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
            <h2 className="font-black text-xl mt-3" style={{ color: PRETO }}>
              {resultado.trial ? `🎉 Sucesso! ${trialDias} dias grátis ativados` : '🎉 Assinatura criada!'}
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              {resultado.trial
                ? <>Plano <strong>{planoNome}</strong> já liberado. Primeira cobrança de <strong>{formatarBRL(resultado.valor)}</strong> em <strong>{dataBR(resultado.primeira_cobranca || resultado.trial_ate)}</strong>.</>
                : <>Estamos processando a primeira cobrança de <strong>{formatarBRL(resultado.valor)}</strong>. O plano ativa assim que o cartão for aprovado.</>}
            </p>
            <button type="button" onClick={() => window.location.assign('/parceiro/painel/minha-assinatura')}
              className="w-full mt-6 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              Ver minha assinatura
            </button>
          </div>
        )}

        {fase === 'erro' && (
          <div className="text-center py-6">
            <p className="text-4xl">💳</p>
            <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{erro}</p>
            <button type="button" onClick={() => { setErro(null); setFase('cartao'); }}
              className="w-full mt-5 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              Tentar com outro cartão
            </button>
            <button type="button" onClick={onFechar} className="w-full mt-2 text-sm font-semibold py-2.5 rounded-xl text-slate-500">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

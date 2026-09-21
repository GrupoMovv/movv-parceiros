import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Loader2, Copy, CheckCircle2, Clock, RotateCcw, QrCode } from 'lucide-react';
import apiParceiro from '../../../services/apiParceiro';
import { ROXO, PRETO } from '../../../pages/public/Marketplace/theme';
import { formatarBRL, dataBR, mensagemErro } from './assinaturaUtils';

const POLLING_MS = 3000;

function formatarContagem(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Modal do PIX: confirma (termos) -> gera QR -> contagem + polling a cada
// 3s -> "Pagamento confirmado". O polling consulta o MP direto no backend
// (sincronizarPagamento), então ativa mesmo se o webhook atrasar.
//   modo 'nova'    -> POST /criar-pix { plano }  (1º mês)
//   modo 'renovar' -> POST /pix/renovar           (próximo mês)
//   pixInicial     -> PIX já gerado e ainda válido (reabre direto no QR)
export default function ModalPix({ plano, planoNome, valor, modo = 'nova', pixInicial = null, creditoAte = null, onFechar }) {
  const [fase, setFase] = useState(pixInicial ? 'qr' : 'confirmar'); // confirmar | gerando | qr | pago | expirado | erro
  const [pix, setPix] = useState(pixInicial);
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState(null);
  const [agora, setAgora] = useState(Date.now());
  const pollRef = useRef(null);

  const restante = pix?.expires_at ? new Date(pix.expires_at).getTime() - agora : 0;

  // Contagem regressiva (1s) + polling do status (3s) enquanto o QR está na tela.
  useEffect(() => {
    if (fase !== 'qr' || !pix) return undefined;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    let parado = false;
    const consultar = async () => {
      try {
        const r = await apiParceiro.get(`/parceiro/assinatura/pagamentos/${pix.pagamento_id}/status`);
        if (parado) return;
        if (r.data.status === 'aprovado') setFase('pago');
        else if (['expirado', 'cancelado', 'rejeitado'].includes(r.data.status)) setFase('expirado');
      } catch { /* rede oscilou: tenta no próximo ciclo */ }
    };
    pollRef.current = setInterval(consultar, POLLING_MS);
    return () => { parado = true; clearInterval(relogio); clearInterval(pollRef.current); };
  }, [fase, pix]);

  // QR venceu na tela: confere uma última vez (pode ter pago no último segundo).
  const conferindoFimRef = useRef(false);
  useEffect(() => {
    if (fase === 'qr' && pix && restante <= 0 && !conferindoFimRef.current) {
      conferindoFimRef.current = true;
      apiParceiro.get(`/parceiro/assinatura/pagamentos/${pix.pagamento_id}/status`)
        .then(r => setFase(r.data.status === 'aprovado' ? 'pago' : 'expirado'))
        .catch(() => setFase('expirado'))
        .finally(() => { conferindoFimRef.current = false; });
    }
  }, [fase, pix, restante]);

  async function gerar() {
    setFase('gerando');
    setErro(null);
    try {
      const r = modo === 'renovar'
        ? await apiParceiro.post('/parceiro/assinatura/pix/renovar', {}, { timeout: 30000 })
        : await apiParceiro.post('/parceiro/assinatura/criar-pix', { plano }, { timeout: 30000 });
      setPix(r.data);
      setAgora(Date.now());
      setFase('qr');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível gerar o PIX agora.'));
      setFase('erro');
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      toast.success('Código PIX copiado!');
    } catch {
      toast.error('Não deu pra copiar — selecione o código e copie manualmente.');
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
        {fase !== 'pago' && (
          <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        )}

        {fase === 'confirmar' && (
          <div>
            <QrCode className="w-8 h-8" style={{ color: ROXO }} />
            <h2 className="font-black text-lg mt-2" style={{ color: PRETO }}>{modo === 'renovar' ? 'Renovar com PIX' : 'Assinar com PIX'}</h2>
            <div className="rounded-2xl bg-slate-50 p-4 mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Plano</span><strong style={{ color: PRETO }}>{planoNome}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Valor</span><strong style={{ color: ROXO }}>{formatarBRL(valor)}/mês</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Acesso</span><strong style={{ color: PRETO }}>{creditoAte && modo === 'nova' ? `1 mês a partir de ${dataBR(creditoAte)}` : '30 dias após o pagamento'}</strong></div>
            </div>
            {modo === 'nova' && creditoAte && (
              <p className="text-xs text-blue-800 bg-blue-50 rounded-xl px-3 py-2 mt-3">
                🔁 Troca de plano: o mês que você pagar agora começa em <strong>{dataBR(creditoAte)}</strong>, depois dos dias que você já pagou — nada é cobrado em dobro.
              </p>
            )}
            {modo === 'nova' && (
              <p className="text-xs text-slate-500 mt-3">
                No PIX o pagamento é na hora e a renovação é mensal (a gente te lembra). O <strong>trial de 7 dias grátis</strong> é só na assinatura com cartão.
              </p>
            )}
            <label className="flex items-start gap-2 mt-4 text-xs text-slate-600">
              <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} className="rounded mt-0.5" />
              Li e aceito: plano mensal do IUB MAIS+, pago por PIX a cada mês. Sem renovação automática — se não pagar o próximo mês, a loja volta pro plano Grátis.
            </label>
            <button type="button" onClick={gerar} disabled={!aceito}
              className="w-full mt-5 text-sm font-bold py-3.5 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>
              Gerar QR Code PIX
            </button>
          </div>
        )}

        {fase === 'gerando' && (
          <div className="text-center py-12">
            <Loader2 className="w-9 h-9 mx-auto animate-spin" style={{ color: ROXO }} />
            <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>Gerando seu PIX...</p>
          </div>
        )}

        {fase === 'qr' && pix && (
          <div className="text-center">
            <h2 className="font-black text-lg" style={{ color: PRETO }}>Pague {formatarBRL(pix.valor)} com PIX</h2>
            <p className="text-xs text-slate-500 mt-1">Abra o app do seu banco, escolha PIX e escaneie o código.</p>
            {pix.qr_code_base64 && (
              <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code PIX" className="w-52 h-52 mx-auto mt-4 rounded-xl border border-slate-100" />
            )}
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold mt-3" style={{ color: restante < 120000 ? '#B91C1C' : PRETO }}>
              <Clock className="w-4 h-4" /> Expira em {formatarContagem(restante)}
            </p>
            <div className="mt-4 text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">PIX copia e cola</p>
              <div className="flex gap-2">
                <input readOnly value={pix.qr_code || ''} onFocus={e => e.target.select()}
                  className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 bg-slate-50" />
                <button type="button" onClick={copiar} className="flex items-center gap-1.5 px-4 rounded-xl text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: ROXO }}>
                  <Copy className="w-4 h-4" /> Copiar
                </button>
              </div>
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando o pagamento — a confirmação aparece aqui sozinha
            </p>
          </div>
        )}

        {fase === 'pago' && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
            <h2 className="font-black text-xl mt-3" style={{ color: PRETO }}>✅ Pagamento confirmado!</h2>
            <p className="text-slate-500 text-sm mt-1">{modo === 'renovar' ? 'Seu plano foi renovado por mais 1 mês.' : `Plano ${planoNome} ativo. Aproveite!`}</p>
            <button type="button" onClick={() => window.location.assign('/parceiro/painel/minha-assinatura')}
              className="w-full mt-6 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              Ver minha assinatura
            </button>
          </div>
        )}

        {fase === 'expirado' && (
          <div className="text-center py-6">
            <Clock className="w-10 h-10 mx-auto text-slate-400" />
            <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>Esse PIX expirou sem pagamento.</p>
            <p className="text-xs text-slate-500 mt-1">Nada foi cobrado. Gere um novo código pra pagar.</p>
            <button type="button" onClick={gerar} className="w-full mt-5 flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              <RotateCcw className="w-4 h-4" /> Gerar novo PIX
            </button>
          </div>
        )}

        {fase === 'erro' && (
          <div className="text-center py-6">
            <p className="text-4xl">⚠️</p>
            <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{erro}</p>
            <button type="button" onClick={() => setFase('confirmar')} className="w-full mt-5 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import apiPainel from '../services/apiPainel';

const NAVY = '#0B1F3A';
const LIME = '#B8E62C';

// Confirma o WhatsApp do cadastro por código de 6 números (o pedido pelo
// site exige). Usado em /meu/dados e no Finalizar pedido. O código vai pro
// número SALVO na conta — quem acabou de digitar outro precisa salvar antes.
export default function ConfirmarWhatsapp({ onConfirmado }) {
  const [envio, setEnvio] = useState(null); // { pedido, whatsapp_mascarado, validade_min, reenvio_seg }
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aguarde, setAguarde] = useState(0);

  useEffect(() => {
    if (aguarde <= 0) return undefined;
    const t = setTimeout(() => setAguarde(a => a - 1), 1000);
    return () => clearTimeout(t);
  }, [aguarde]);

  async function pedirCodigo() {
    setErro(null);
    setCarregando(true);
    try {
      const res = await apiPainel.post('/public/painel/whatsapp/enviar-codigo');
      if (res.data.ja_confirmado) { onConfirmado?.(); return; }
      setEnvio(res.data);
      setAguarde(res.data.reenvio_seg);
      setCodigo('');
      toast.success('Código enviado pelo WhatsApp!');
    } catch (err) {
      const r = err.response?.data || {};
      if (r.code === 'AGUARDE') setAguarde(r.aguarde_seg);
      setErro(r.error || 'Não conseguimos enviar o código agora. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar(e) {
    e.preventDefault();
    if (codigo.length !== 6) { setErro('O código tem 6 números.'); return; }
    setErro(null);
    setCarregando(true);
    try {
      await apiPainel.post('/public/painel/whatsapp/confirmar', { pedido: envio.pedido, codigo });
      toast.success('WhatsApp confirmado!');
      onConfirmado?.();
    } catch (err) {
      const r = err.response?.data || {};
      if (r.code === 'CODIGO_EXPIRADO') { setEnvio(null); setCodigo(''); }
      setErro(r.error || 'Não conseguimos confirmar agora. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }

  if (!envio) {
    return (
      <div className="space-y-2">
        <button
          type="button" onClick={pedirCodigo} disabled={carregando || aguarde > 0}
          className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: LIME, color: NAVY }}
        >
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsappLogo size={18} weight="fill" />}
          {aguarde > 0 ? `Aguarde ${aguarde}s` : 'Enviar código pelo WhatsApp'}
        </button>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="space-y-2" noValidate>
      <p className="text-xs text-slate-500">
        Enviamos um código para <strong>{envio.whatsapp_mascarado}</strong>. Vale por {envio.validade_min} minutos.
      </p>
      <input
        className="input text-2xl tracking-[0.5em] text-center" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
        aria-label="Código de 6 números"
        value={codigo} onChange={e => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setErro(null); }}
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <button
        type="submit" disabled={carregando}
        className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: LIME, color: NAVY }}
      >
        {carregando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
      </button>
      <button
        type="button" onClick={pedirCodigo} disabled={aguarde > 0 || carregando}
        className="w-full text-xs font-semibold text-slate-500 underline underline-offset-4 py-2 disabled:opacity-50 disabled:no-underline"
      >
        {aguarde > 0 ? `Reenviar código em ${aguarde}s` : 'Reenviar código'}
      </button>
    </form>
  );
}

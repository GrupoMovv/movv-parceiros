import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Download, MessageCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { assetUrl } from '../../../services/api';
import { publicCarteirinhaUrl } from '../../../utils/carteirinhaWhatsapp';
import AvatarPlaceholder from '../../../components/AvatarPlaceholder';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';

export default function MinhasCarteirinhas() {
  const { dados } = useOutletContext();

  const cartoes = [
    { hash: dados.carteirinha_hash, nome: dados.nome_completo, foto_url: dados.foto_url, titular: true },
    ...dados.dependentes.filter(d => d.carteirinha_hash).map(d => ({ hash: d.carteirinha_hash, nome: d.nome, foto_url: d.foto_url, titular: false })),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Minhas Carteirinhas</h1>
        <p className="text-slate-400 text-xs mt-1">A sua e a dos seus dependentes, tudo num só lugar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cartoes.map(c => <CartaoMini key={c.hash} {...c} />)}
      </div>
    </div>
  );
}

function CartaoMini({ hash, nome, foto_url, titular }) {
  const cardRef = useRef(null);
  const [baixando, setBaixando] = useState(false);
  const url = publicCarteirinhaUrl(hash);

  async function handleBaixar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `carteirinha-seci-${nome.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      toast.error('Não deu pra baixar agora. Tenta de novo.');
    } finally {
      setBaixando(false);
    }
  }

  function handleCompartilhar() {
    const texto = encodeURIComponent(`Carteirinha digital SECI — ${nome}\n${url}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não deu pra copiar o link');
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div ref={cardRef} className="p-5" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1E4A8A 100%)' }}>
        <div className="flex items-center gap-3">
          {foto_url ? (
            <img src={assetUrl(foto_url)} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${GOLD}` }} />
          ) : (
            <AvatarPlaceholder nome={nome} size={56} className="border-2" style={{ borderColor: GOLD }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm truncate">{nome}</p>
            <p className="text-white/60 text-[11px]">{titular ? 'Titular' : 'Dependente'}</p>
          </div>
          <div className="p-1.5 bg-white rounded-lg flex-shrink-0">
            <QRCodeSVG value={url} className="w-12 h-12" fgColor="#0B1F3A" />
          </div>
        </div>
      </div>

      <div className="p-3 grid grid-cols-4 gap-1.5">
        <a href={url} target="_blank" rel="noreferrer" title="Ver em tela cheia" className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500">
          <Maximize2 className="w-4 h-4" /> <span className="text-[10px] font-semibold">Ver</span>
        </a>
        <button type="button" onClick={handleBaixar} disabled={baixando} title="Baixar PNG" className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 disabled:opacity-50">
          {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} <span className="text-[10px] font-semibold">Baixar</span>
        </button>
        <button type="button" onClick={handleCompartilhar} title="Compartilhar no WhatsApp" className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500">
          <MessageCircle className="w-4 h-4" /> <span className="text-[10px] font-semibold">Zap</span>
        </button>
        <button type="button" onClick={handleCopiar} title="Copiar link" className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500">
          <LinkIcon className="w-4 h-4" /> <span className="text-[10px] font-semibold">Copiar</span>
        </button>
      </div>
    </div>
  );
}

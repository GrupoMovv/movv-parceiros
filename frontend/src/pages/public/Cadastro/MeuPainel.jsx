import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2, CreditCard, Users2, User, ExternalLink, MessageCircle, Gift, CheckCircle2, ShoppingBag,
} from 'lucide-react';
import apiPainel from '../../../services/apiPainel';
import api, { assetUrl } from '../../../services/api';
import {
  publicCarteirinhaUrl, publicBeneficiosPdfUrl, montarMensagemCadastroPublico, linkWhatsappComTexto,
} from '../../../utils/carteirinhaWhatsapp';
import AvatarPlaceholder from '../../../components/AvatarPlaceholder';

const GOLD = '#D4AF37';

// Dashboard (rota índice de /meu) — dados/foto/dependentes viraram rotas
// dedicadas (MeuDados, MeuDependentes, MinhasCarteirinhas), o layout pai
// (MeuPainelLayout) já cuida de auth + fetch, aqui só consome via contexto.
export default function MeuPainel() {
  const { dados } = useOutletContext();
  const [reenviando, setReenviando] = useState(false);
  const [qtdParceiros, setQtdParceiros] = useState(null);

  useEffect(() => {
    api.get('/public/marketplace/stats').then(res => setQtdParceiros(res.data.parceiros)).catch(() => {});
  }, []);

  async function handleReenviar() {
    setReenviando(true);
    try {
      const res = await apiPainel.post('/public/painel/reenviar-carteirinha');
      const nomeCurto = res.data.nome_completo.trim().split(/\s+/)[0];
      const urlTitular = publicCarteirinhaUrl(res.data.carteirinha_hash);
      const urlPainel = `${window.location.origin}/cadastrar`;
      const mensagem = montarMensagemCadastroPublico(urlTitular, urlPainel);
      if (!res.data.whatsapp) {
        toast.error('Cadastre seu WhatsApp em "Meus Dados" antes de reenviar');
        return;
      }
      window.open(linkWhatsappComTexto(res.data.whatsapp, mensagem), '_blank');
    } catch {
      toast.error('Erro ao reenviar carteirinha');
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {dados.foto_url ? (
          <img src={assetUrl(dados.foto_url)} alt="" className="w-20 h-20 rounded-full object-cover border-4 flex-shrink-0" style={{ borderColor: GOLD }} />
        ) : (
          <AvatarPlaceholder nome={dados.nome_completo} size={80} className="border-4" style={{ borderColor: GOLD }} />
        )}
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{dados.nome_completo}</p>
          <p className="text-slate-400 text-xs">{dados.empresa}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${dados.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <CheckCircle2 className="w-2.5 h-2.5" /> {dados.ativo ? 'ATIVO' : 'INATIVO'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-3.5 text-center">
          <p className="text-xl font-black text-slate-900">{dados.dependentes.length}/5</p>
          <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wide mt-0.5">Dependentes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3.5 text-center">
          <p className="text-xl font-black text-slate-900">{qtdParceiros ?? '—'}</p>
          <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wide mt-0.5">Parceiros ativos</p>
        </div>
      </div>

      <Link
        to={`/marketplace?associado=${dados.carteirinha_hash}`}
        className="block rounded-2xl p-4 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
      >
        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-sm">🛍️ Marketplace IUB MAIS</p>
            <p className="text-white/85 text-xs mt-0.5">
              Compre com desconto exclusivo{qtdParceiros ? ` em ${qtdParceiros} parceiros` : ''}!
            </p>
          </div>
        </div>
        <span className="relative block mt-3 w-full text-center text-sm font-bold py-2.5 rounded-xl bg-white" style={{ color: '#15803D' }}>
          Ir pro marketplace agora
        </span>
      </Link>

      <div className="space-y-2.5">
        <CardAcao icon={<CreditCard className="w-4 h-4" />} titulo="Minha Carteirinha" sub="Ver ou reenviar pelo WhatsApp">
          <div className="flex gap-2 mt-2">
            <a href={publicCarteirinhaUrl(dados.carteirinha_hash)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Ver
            </a>
            <button onClick={handleReenviar} disabled={reenviando} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#25D366' }}>
              {reenviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} Reenviar
            </button>
          </div>
        </CardAcao>

        <Link to="/meu/dependentes" className="block">
          <CardAcao icon={<Users2 className="w-4 h-4" />} titulo={`Dependentes (${dados.dependentes.length})`} sub="Gerenciar dependentes e fotos" />
        </Link>

        <Link to="/meu/carteirinhas" className="block">
          <CardAcao icon={<CreditCard className="w-4 h-4" />} titulo="Minhas carteirinhas" sub="Suas e as dos dependentes, num só lugar" />
        </Link>

        <Link to="/meu/dados" className="block">
          <CardAcao icon={<User className="w-4 h-4" />} titulo="Meus dados" sub="Contato, endereço, foto e preferências" />
        </Link>

        <a href={publicBeneficiosPdfUrl()} target="_blank" rel="noreferrer" className="block">
          <CardAcao icon={<Gift className="w-4 h-4" />} titulo="Ver benefícios" sub="Catálogo completo em PDF" />
        </a>
      </div>
    </div>
  );
}

function CardAcao({ icon, titulo, sub, children }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FDF8ED', color: GOLD }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{titulo}</p>
          <p className="text-slate-400 text-xs">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

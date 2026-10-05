import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import PedidoLojaDetalhe from '../../components/pedidos/PedidoLojaDetalhe';

const ROXO = '#5B21B6';
const PRETO = '#0F172A';

// /pedido-loja/:token — o link do aviso de WhatsApp da LOJA, sem login.
// No máximo 2 toques: Aceitar (ou Recusar) e "Pago, saiu". /pedido-loja/teste
// é o link do "Enviar aviso de teste" do painel. O corpo (pedido + ações) é o
// mesmo da aba Pedidos do painel (PedidoLojaDetalhe).
export default function PedidoLoja() {
  const { token } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  function carregar() {
    api.get(`/public/pedido-loja/${token}`).then(res => setPedido(res.data))
      .catch(err => setErro(err.response?.data?.error || 'Não conseguimos abrir o pedido agora.'));
  }
  useEffect(() => { if (token !== 'teste') carregar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <Casca>
      <PedidoLojaDetalhe
        pedido={pedido}
        setPedido={setPedido}
        recarregar={carregar}
        executar={(acao, corpo) => api.post(`/public/pedido-loja/${token}/${acao}`, corpo).then(r => r.data)}
      />
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

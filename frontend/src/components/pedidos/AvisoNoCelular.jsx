import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, Loader2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';

// A5: notificação do navegador de pedido novo, mesmo com o site minimizado.
// Funciona no Android (Chrome, Edge, Samsung) e no computador com o navegador
// aberto. No iPhone, só com o IUB MAIS+ na Tela de Início (iOS 16.4+).
// O WhatsApp continua sendo o aviso principal.

function chaveEmBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bruto, c => c.charCodeAt(0));
}

const ehIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const naTelaDeInicio = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function suporte() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return ehIphone() && !naTelaDeInicio() ? 'iphone' : 'sem_suporte';
  }
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'ok';
}

export default function AvisoNoCelular({ Secao }) {
  const [info, setInfo] = useState(null); // { chave_publica, aparelhos }
  const [inscrito, setInscrito] = useState(false);
  const [situacao] = useState(suporte);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    apiParceiro.get('/parceiro/pedidos/push').then(r => setInfo(r.data)).catch(() => setInfo({ chave_publica: null }));
    if (situacao === 'ok') {
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(s => setInscrito(Boolean(s))).catch(() => {});
    }
  }, [situacao]);

  // sem as chaves no servidor, o recurso ainda não está no ar: não mostra nada
  if (!info?.chave_publica) return null;

  async function ativar() {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') { toast.error('Sem a permissão do navegador o aviso não chega.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const inscricao = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(info.chave_publica) });
      const r = await apiParceiro.post('/parceiro/pedidos/push/inscrever', { inscricao: inscricao.toJSON() });
      setInfo(i => ({ ...i, aparelhos: r.data.aparelhos }));
      setInscrito(true);
      toast.success('Pronto! Este aparelho avisa quando chegar pedido.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não conseguimos ativar neste aparelho.');
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao) {
        const r = await apiParceiro.post('/parceiro/pedidos/push/cancelar', { endpoint: inscricao.endpoint });
        await inscricao.unsubscribe();
        setInfo(i => ({ ...i, aparelhos: r.data.aparelhos }));
      }
      setInscrito(false);
      toast.success('Este aparelho não recebe mais o aviso.');
    } catch {
      toast.error('Não conseguimos desativar agora.');
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    try {
      const r = await apiParceiro.post('/parceiro/pedidos/push/teste');
      if (r.data.enviados > 0) toast.success('Aviso de teste enviado. Deve aparecer em instantes.');
      else toast.error('Nenhum aparelho recebeu. Desative e ative de novo.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao mandar o teste');
    } finally {
      setOcupado(false);
    }
  }

  const botao = 'px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50';
  return (
    <Secao titulo="Aviso no celular" subtitulo="Pedido novo aparece como notificação, mesmo com o site minimizado ou a tela bloqueada. O WhatsApp continua chegando.">
      {situacao === 'iphone' && (
        <p className="text-sm text-slate-700">
          No iPhone, o aviso só funciona com o IUB MAIS+ na Tela de Início: no Safari, toque em <strong>Compartilhar</strong> e em
          {' '}<strong>Adicionar à Tela de Início</strong>. Abra o IUB MAIS+ pelo ícone novo, entre no painel e volte aqui.
        </p>
      )}
      {situacao === 'sem_suporte' && (
        <p className="text-sm text-slate-700">Este navegador não recebe o aviso. No celular Android, use o Chrome; no computador, o Chrome ou o Edge.</p>
      )}
      {situacao === 'bloqueado' && (
        <p className="text-sm text-slate-700">
          O aviso está bloqueado neste navegador. Toque no cadeado ao lado do endereço do site, libere as <strong>Notificações</strong> e recarregue a página.
        </p>
      )}
      {situacao === 'ok' && (
        <div className="space-y-3">
          {inscrito ? (
            <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><BellRing className="w-4 h-4" /> Ativo neste aparelho.</p>
          ) : (
            <p className="text-sm text-slate-700">Ative em cada celular ou computador que deve tocar quando chegar pedido.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!inscrito && (
              <button type="button" onClick={ativar} disabled={ocupado} className={`${botao} text-white bg-violet-700`}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔔 Ativar aviso neste aparelho'}
              </button>
            )}
            {inscrito && (
              <>
                <button type="button" onClick={testar} disabled={ocupado} className={`${botao} text-violet-700 border-2 border-violet-200`}>Mandar um teste</button>
                <button type="button" onClick={desativar} disabled={ocupado} className={`${botao} text-slate-600 border border-slate-200`}>Desativar neste aparelho</button>
              </>
            )}
          </div>
        </div>
      )}
      {info.aparelhos > 0 && (
        <p className="text-xs text-slate-400 mt-3">{info.aparelhos === 1 ? '1 aparelho recebe' : `${info.aparelhos} aparelhos recebem`} o aviso desta loja.</p>
      )}
    </Secao>
  );
}

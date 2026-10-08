import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { assetUrl } from '../../../services/api';
import apiPainel from '../../../services/apiPainel';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useAssociadoSessao } from './useAssociadoSessao';
import { ROXO, ROXO_ESCURO, DOURADO } from './theme';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';

// /clube — página do Clube MAIS+ (marca neutra; decisões do Junior, 07/10).
// Duas portas, com o mesmo peso: a assinatura de R$ 9,90 vem primeiro (por
// enquanto "Quero ser avisado" = lista de interessados) e "Trabalho no
// comércio" (filiado ao sindicato: sai de graça — ÚNICO lugar público onde o
// SECI é citado, decisão 15). /clube#avisar abre direto no formulário.

const COMO_FUNCIONA = [
  { icone: '💎', titulo: 'Preço Clube', texto: 'Nas Lojas do Clube, o produto mostra o preço Clube. Membro paga o menor preço a que tem direito.' },
  { icone: '🛍️', titulo: 'No site ou no WhatsApp', texto: 'Compre pelo botão Comprar ou chame a loja: a mensagem já diz que você é do Clube.' },
  { icone: '📇', titulo: 'Cartão do Clube', texto: 'Seu cartão mostra só o seu nome e a validade, para a loja conferir.' },
];

function mascararWhatsapp(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function QueroSerAvisado({ associado, origem }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [autorizo, setAutorizo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!associado) return;
    setNome(n => n || associado.nome_completo || '');
    setWhatsapp(w => w || mascararWhatsapp(associado.whatsapp || ''));
  }, [associado]);

  useEffect(() => { if (window.location.hash === '#avisar') setAberto(true); }, []);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await apiPainel.post('/public/clube/interessados', { nome, whatsapp, autorizou_contato: autorizo, origem });
      setPronto(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não deu para salvar agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return <p className="mt-4 text-sm font-semibold rounded-xl px-4 py-3 bg-emerald-50 text-emerald-800">✅ Pronto! Avisamos você no WhatsApp quando a assinatura abrir.</p>;
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="mt-4 text-center text-sm font-bold px-5 py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
        Quero ser avisado
      </button>
    );
  }
  return (
    <form onSubmit={enviar} className="mt-4 space-y-3">
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" maxLength={120} required
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200" />
      <input value={whatsapp} onChange={e => setWhatsapp(mascararWhatsapp(e.target.value))} placeholder="WhatsApp com DDD" inputMode="tel" required
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200" />
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={autorizo} onChange={e => setAutorizo(e.target.checked)} className="mt-0.5 rounded" />
        Autorizo o IUB MAIS+ a me avisar pelo WhatsApp quando a assinatura do Clube abrir.
      </label>
      <button type="submit" disabled={enviando || !autorizo} className="w-full text-sm font-bold px-5 py-3 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>
        {enviando ? 'Enviando…' : 'Quero ser avisado'}
      </button>
    </form>
  );
}

export default function Clube() {
  const navigate = useNavigate();
  const location = useLocation();
  const { associado, ehAssociadoSeci, carregando, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const origem = new URLSearchParams(location.search).get('origem') || 'pagina_clube';

  useEffect(() => {
    if (location.hash !== '#avisar') return;
    const t = setTimeout(() => document.getElementById('avisar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [location.hash, carregando]);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregando}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={() => navigate('/marketplace')}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-8 w-full pt-2">
        <BotaoVoltar fallback="/marketplace" />
      </div>

      <header className="w-full" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14 text-white">
          <p className="text-4xl">💎</p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Clube MAIS+</h1>
          <p className="text-white/85 text-base sm:text-lg mt-2 max-w-xl">Preço menor nas lojas de Itumbiara.</p>
          {!carregando && ehAssociadoSeci && (
            <p className="inline-block mt-5 text-sm font-bold px-4 py-2 rounded-xl" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              ✅ Você já é do Clube. Seus preços Clube aparecem automaticamente.
            </p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 w-full py-10 space-y-12">
        <section>
          <h2 className="text-xl sm:text-2xl font-black" style={{ color: ROXO_ESCURO }}>Como funciona</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            {COMO_FUNCIONA.map(c => (
              <div key={c.titulo} className="rounded-2xl border border-slate-100 p-5">
                <p className="text-2xl">{c.icone}</p>
                <p className="font-bold mt-2" style={{ color: ROXO_ESCURO }}>{c.titulo}</p>
                <p className="text-sm text-slate-600 mt-1">{c.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {!ehAssociadoSeci && (
          <section id="avisar" className="scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black" style={{ color: ROXO_ESCURO }}>Como entrar</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border-2 p-5 flex flex-col" style={{ borderColor: ROXO }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ROXO }}>Assinatura</p>
                <p className="text-lg font-black mt-1" style={{ color: ROXO_ESCURO }}>R$ 9,90 por mês</p>
                <p className="text-sm text-slate-600 mt-2 flex-1">Para qualquer pessoa. Está quase abrindo: deixe seu WhatsApp e avisamos você.</p>
                <QueroSerAvisado associado={associado} origem={origem} />
              </div>
              <div className="rounded-2xl border-2 p-5 flex flex-col" style={{ borderColor: ROXO }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ROXO }}>Trabalho no comércio</p>
                <p className="text-lg font-black mt-1" style={{ color: ROXO_ESCURO }}>Trabalha no comércio? Pode sair de graça.</p>
                <p className="text-sm text-slate-600 mt-2 flex-1">
                  Se você trabalha no comércio de Itumbiara e é filiado ao SECI (Sindicato dos Empregados no Comércio de Itumbiara),
                  o Clube MAIS+ vem incluído na sua filiação.
                </p>
                <Link to="/cadastrar-associado" className="mt-4 text-center text-sm font-bold px-5 py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                  Verificar se posso ativar
                </Link>
              </div>
            </div>
            {!associado && (
              <p className="text-sm text-slate-500 mt-5">
                Já é do Clube?{' '}
                <Link to="/entrar?voltar=/marketplace" className="font-semibold underline" style={{ color: ROXO }}>Entrar</Link>
              </p>
            )}
          </section>
        )}
      </main>

      <Footer />
      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

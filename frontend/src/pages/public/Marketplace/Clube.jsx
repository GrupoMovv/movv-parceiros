import { Link, useNavigate } from 'react-router-dom';
import { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useAssociadoSessao } from './useAssociadoSessao';
import { ROXO, ROXO_ESCURO, DOURADO } from './theme';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';

// /clube — página do Clube MAIS+ (marca neutra; decisões do Junior, 07/10).
// Duas portas: "Trabalho no comércio" (filiado ao sindicato: sai de graça —
// ÚNICO lugar público onde o SECI é citado, decisão 15) e a assinatura de
// R$ 9,90 (por enquanto "em breve"; a lista de interessados é a parte d1).

const COMO_FUNCIONA = [
  { icone: '💎', titulo: 'Preço Clube', texto: 'Nas Lojas do Clube, o produto mostra o preço Clube. Membro paga o menor preço a que tem direito.' },
  { icone: '🛍️', titulo: 'No site ou no WhatsApp', texto: 'Compre pelo botão Comprar ou chame a loja: a mensagem já diz que você é do Clube.' },
  { icone: '📇', titulo: 'Cartão do Clube', texto: 'Seu cartão mostra só o seu nome e a validade, para a loja conferir.' },
];

export default function Clube() {
  const navigate = useNavigate();
  const { associado, ehAssociadoSeci, carregando, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

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
          <section>
            <h2 className="text-xl sm:text-2xl font-black" style={{ color: ROXO_ESCURO }}>Como entrar</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border-2 p-5 flex flex-col" style={{ borderColor: DOURADO }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#92700C' }}>Trabalho no comércio</p>
                <p className="text-lg font-black mt-1" style={{ color: ROXO_ESCURO }}>Trabalha no comércio? Pode sair de graça.</p>
                <p className="text-sm text-slate-600 mt-2 flex-1">
                  Se você trabalha no comércio de Itumbiara e é filiado ao SECI (Sindicato dos Empregados no Comércio de Itumbiara),
                  o Clube MAIS+ vem incluído na sua filiação.
                </p>
                <Link to="/cadastrar-associado" className="mt-4 text-center text-sm font-bold px-5 py-3 rounded-xl" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                  Verificar se posso ativar
                </Link>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 flex flex-col">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Assinatura</p>
                <p className="text-lg font-black mt-1" style={{ color: ROXO_ESCURO }}>R$ 9,90 por mês</p>
                <p className="text-sm text-slate-600 mt-2 flex-1">Para qualquer pessoa. Em breve.</p>
                <span className="mt-4 text-center text-sm font-bold px-5 py-3 rounded-xl bg-slate-100 text-slate-500">Em breve</span>
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

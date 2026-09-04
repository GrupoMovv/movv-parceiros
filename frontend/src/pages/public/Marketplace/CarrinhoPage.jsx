import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingCart, MessageCircle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Diamond, Storefront } from '@phosphor-icons/react';
import { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useCarrinho } from './CarrinhoContext';
import { useAssociadoSessao } from './useAssociadoSessao';
import { useFavoritos } from './useFavoritos';
import { PRETO, ROXO } from './theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CarrinhoPage() {
  const navigate = useNavigate();
  const { grupos, totalItens, carregando, remover, limpar } = useCarrinho();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const { favoritos } = useFavoritos();
  const [modalChamarTodosAberto, setModalChamarTodosAberto] = useState(false);
  // parceiro_id de quem já foi chamado no WhatsApp nesta visita — abrir
  // várias janelas em sequência (window.open várias vezes seguidas) é
  // bloqueado silenciosamente pela maioria dos navegadores, então cada
  // clique agora é seu próprio gesto do usuário, um de cada vez.
  const [chamados, setChamados] = useState(() => new Set());

  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const totalParceiros = grupos.length;
  const gruposComWhatsapp = grupos.filter(g => g.url_final);
  const todosChamados = gruposComWhatsapp.length > 0 && gruposComWhatsapp.every(g => chamados.has(g.parceiro_id));

  function handleSearchSubmit() { navigate('/marketplace'); }

  function abrirWhatsappGrupo(grupo) {
    if (!grupo.url_final) {
      toast.error(`${grupo.parceiro_nome} ainda não cadastrou um WhatsApp`);
      return;
    }
    window.open(grupo.url_final, '_blank');
    setChamados(atual => new Set(atual).add(grupo.parceiro_id));
  }

  async function handleLimpar() {
    if (!window.confirm('Remover todos os produtos do carrinho?')) return;
    await limpar();
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carregandoAssociado={carregandoAssociado}
        favoritosAtivos={false}
        onToggleFavoritos={() => navigate('/marketplace')}
        qtdFavoritos={favoritos.length}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={handleSearchSubmit}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-8 w-full py-6 flex-1">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight" style={{ color: PRETO }}>
            <ShoppingCart size={24} weight="duotone" color={ROXO} />
            Meu Carrinho {!carregando && `(${totalItens} produto${totalItens === 1 ? '' : 's'})`}
          </h1>
          {totalItens > 0 && (
            <button onClick={handleLimpar} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors whitespace-nowrap">
              Limpar carrinho
            </button>
          )}
        </div>

        {carregando ? (
          <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center text-center py-20 gap-3">
            <ShoppingCart size={56} weight="light" className="text-slate-200" />
            <p className="font-bold text-lg" style={{ color: PRETO }}>Seu carrinho está vazio</p>
            <p className="text-slate-400 text-sm max-w-xs">Adicione produtos que você gostou pra conversar com os parceiros depois.</p>
            <Link to="/marketplace" className="mt-2 text-sm font-semibold px-6 py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
              Explorar produtos
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {grupos.map(grupo => (
                <div key={grupo.parceiro_id} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                    {grupo.parceiro_logo_url ? (
                      <img src={grupo.parceiro_logo_url} alt="" className="w-8 h-8 rounded-full object-cover bg-white border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-50 text-xs font-bold" style={{ color: ROXO }}>
                        {grupo.parceiro_nome[0]}
                      </div>
                    )}
                    <Link to={`/marketplace/parceiro/${grupo.parceiro_slug}`} className="font-bold text-sm hover:underline" style={{ color: PRETO }}>
                      {grupo.parceiro_nome}
                    </Link>
                    <span className="text-slate-400 text-xs ml-auto whitespace-nowrap">{grupo.produtos.length} produto{grupo.produtos.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {grupo.produtos.map(p => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <Link to={`/marketplace/produto/${p.id}`} className="w-14 h-14 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.foto_url ? <img src={p.foto_url} alt="" className="w-full h-full object-contain" /> : <ShoppingCart size={18} className="text-slate-200" />}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/marketplace/produto/${p.id}`} className="text-sm font-medium line-clamp-2 hover:underline" style={{ color: PRETO }}>{p.nome}</Link>
                          {p.preco_associado ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-slate-400 text-xs line-through">{formatarPreco(p.preco)}</span>
                              <span className="font-bold text-sm" style={{ color: ROXO }}>{formatarPreco(p.preco_associado)}</span>
                              <Diamond size={10} weight="fill" color="#FFB800" />
                            </div>
                          ) : (
                            <span className="font-bold text-sm text-slate-800">{formatarPreco(p.preco)}</span>
                          )}
                        </div>
                        <button
                          type="button" onClick={() => remover(p.id)} aria-label="Remover"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => abrirWhatsappGrupo(grupo)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white py-3 rounded-xl transition-transform hover:scale-[1.01]"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-4 h-4" /> Chamar {grupo.parceiro_nome} no WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500 text-center sm:text-left">
                <strong style={{ color: PRETO }}>{totalParceiros}</strong> parceiro{totalParceiros === 1 ? '' : 's'} · <strong style={{ color: PRETO }}>{totalItens}</strong> produto{totalItens === 1 ? '' : 's'}
              </div>
              <button
                type="button"
                onClick={() => setModalChamarTodosAberto(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold text-white px-6 py-3.5 rounded-xl transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: '#128C4A' }}
              >
                <MessageCircle className="w-4 h-4" /> Chamar todos os parceiros ({totalParceiros})
              </button>
            </div>

            <Link to="/marketplace" className="inline-block mt-6 text-sm font-semibold underline" style={{ color: ROXO }}>
              ← Continuar comprando
            </Link>
          </>
        )}
      </div>

      <Footer />

      <MobileBottomNav
        favoritosAtivos={false}
        onToggleFavoritos={() => navigate('/marketplace')}
        nomeAssociado={nomeAssociado}
        onLoginSuccess={recarregar}
      />

      {modalChamarTodosAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={() => setModalChamarTodosAberto(false)}>
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button
              type="button" onClick={() => setModalChamarTodosAberto(false)} aria-label="Fechar"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <MessageCircle size={32} color="#25D366" />
            <h2 className="text-lg font-extrabold mt-2" style={{ color: PRETO }}>Chamar parceiros do carrinho</h2>
            <p className="text-slate-500 text-sm mt-1">
              O navegador bloqueia várias janelas abertas de uma vez — clique em cada parceiro pra abrir o WhatsApp, um de cada vez.
            </p>

            {todosChamados && (
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-center">
                <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Todos os parceiros foram contatados!
                </p>
                <div className="flex items-center justify-center gap-3 mt-2.5">
                  <button
                    onClick={async () => { await limpar(); setModalChamarTodosAberto(false); }}
                    className="text-xs font-semibold text-emerald-700 underline"
                  >
                    Limpar carrinho
                  </button>
                  <Link to="/marketplace" onClick={() => setModalChamarTodosAberto(false)} className="text-xs font-semibold text-emerald-700 underline">
                    Continuar comprando
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-2.5 mt-4">
              {grupos.map(grupo => {
                const jaChamado = chamados.has(grupo.parceiro_id);
                return (
                  <div key={grupo.parceiro_id} className="border border-slate-100 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50">
                      {grupo.parceiro_logo_url ? (
                        <img src={grupo.parceiro_logo_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Storefront size={16} weight="duotone" color={ROXO} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: PRETO }}>{grupo.parceiro_nome}</p>
                      <p className="text-slate-400 text-xs">{grupo.produtos.length} produto{grupo.produtos.length === 1 ? '' : 's'}</p>
                    </div>
                    {jaChamado ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 px-3 py-2 flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> Chamado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirWhatsappGrupo(grupo)}
                        disabled={!grupo.url_final}
                        className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2.5 rounded-lg flex-shrink-0 disabled:opacity-40"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Abrir WhatsApp
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setModalChamarTodosAberto(false)} className="w-full mt-5 text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

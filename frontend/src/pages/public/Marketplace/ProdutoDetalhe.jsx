import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight, Heart, Share2, Star, MapPin, MessageCircle, ImageOff, Loader2, PackageX,
} from 'lucide-react';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './theme';
import { useFavoritos } from './useFavoritos';

const CHAVE_FAVORITOS_PRODUTOS = 'iub_mais_produtos_favoritos';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProdutoDetalhe() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const associadoHash = searchParams.get('associado');

  const [produto, setProduto] = useState(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [erroRede, setErroRede] = useState(false);
  const [outros, setOutros] = useState([]);
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [nomeAssociado, setNomeAssociado] = useState(null);
  const [descricaoExpandida, setDescricaoExpandida] = useState(false);
  const [carregandoWhatsapp, setCarregandoWhatsapp] = useState(false);
  const { alternar: alternarFavorito, ehFavorito } = useFavoritos(CHAVE_FAVORITOS_PRODUTOS);

  const ehAssociado = Boolean(nomeAssociado);

  function carregarProduto() {
    setErroRede(false);
    setNaoEncontrado(false);
    api.get(`/public/produtos/${id}`)
      .then(res => setProduto(res.data))
      .catch(err => {
        if (err.response?.status === 404) setNaoEncontrado(true);
        else setErroRede(true);
      });
  }

  useEffect(() => { carregarProduto(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (associadoHash) {
      api.get(`/public/carteirinha/${associadoHash}`)
        .then(res => setNomeAssociado(res.data.nome?.trim().split(/\s+/)[0] || null))
        .catch(() => {});
      return;
    }
    if (getPainelToken()) {
      apiPainel.get('/public/painel/me')
        .then(res => setNomeAssociado(res.data.nome_completo?.trim().split(/\s+/)[0] || null))
        .catch(() => {});
    }
  }, [associadoHash]);

  useEffect(() => {
    if (!produto) return;
    document.title = `${produto.nome} — ${produto.parceiro_nome} | IUB MAIS`;
    api.post(`/public/produtos/${id}/visualizacao`, { tipo: 'ver_produto', associado_hash: associadoHash }).catch(() => {});
    api.get(`/public/produtos/${id}/outros-do-parceiro`).then(res => setOutros(res.data.produtos)).catch(() => {});
  }, [produto, id, associadoHash]);

  const mensagemWhatsapp = useMemo(() => {
    if (!produto) return '';
    return `Olá! Vi seu produto ${produto.nome} no IUB MAIS e tenho interesse. Poderia me passar mais informações?`;
  }, [produto]);

  // Abre a aba em branco de forma síncrona (dentro do gesto de clique) e só
  // depois navega ela pra URL do WhatsApp — abrir a aba só após o await do
  // fetch é bloqueado por popup blocker em boa parte dos navegadores mobile.
  async function handleWhatsappClick() {
    if (carregandoWhatsapp || !produto?.parceiro_whatsapp || !produto.estoque_disponivel) return;
    const novaAba = window.open('', '_blank');
    setCarregandoWhatsapp(true);
    try {
      const res = await api.get(`/public/produtos/${id}/mensagem-whatsapp`, {
        params: associadoHash ? { associado: associadoHash } : {},
      });
      if (novaAba) novaAba.location.href = res.data.url_final;
      else window.open(res.data.url_final, '_blank');
    } catch {
      const fallback = linkWhatsappComTexto(produto.parceiro_whatsapp, mensagemWhatsapp);
      if (novaAba) novaAba.location.href = fallback;
      else window.open(fallback, '_blank');
    } finally {
      setCarregandoWhatsapp(false);
    }
    api.post(`/public/produtos/${id}/visualizacao`, { tipo: 'clique_whatsapp', associado_hash: associadoHash }).catch(() => {});
  }

  async function handleCompartilhar() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: produto.nome, text: mensagemWhatsapp, url }); } catch { /* usuário cancelou */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copiado!');
      } catch { /* clipboard indisponível */ }
    }
  }

  if (naoEncontrado) return <Produto404 />;

  if (erroRede) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-500 text-sm text-center">Não foi possível carregar esse produto agora.</p>
        <button onClick={carregarProduto} className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!produto) return <ProdutoSkeleton />;

  const whatsappHabilitado = Boolean(produto.parceiro_whatsapp) && produto.estoque_disponivel;

  const temPrecoAssociado = Boolean(produto.preco_associado);
  const economia = temPrecoAssociado ? parseFloat(produto.preco) - parseFloat(produto.preco_associado) : 0;
  const favorito = ehFavorito(produto.id);
  const descricaoLonga = (produto.descricao || '').length > 180;

  return (
    <div className="min-h-screen w-full bg-white pb-24 sm:pb-10">
      {/* breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-5 flex items-center gap-1 text-xs text-slate-400 flex-wrap">
        <Link to="/marketplace" className="hover:underline">Home</Link>
        {produto.categoria && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span>{produto.categoria}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{produto.nome}</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* galeria */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50">
            {produto.fotos?.length ? (
              <img src={produto.fotos[fotoAtiva]?.url} alt={produto.nome} className="w-full h-full object-cover transition-opacity duration-300" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <ImageOff className="w-10 h-10" />
                <p className="text-xs mt-2">Sem foto</p>
              </div>
            )}
          </div>

          {produto.fotos?.length > 1 && (
            <>
              {/* miniaturas — desktop */}
              <div className="hidden sm:flex gap-2 mt-3">
                {produto.fotos.slice(0, 3).map((f, i) => (
                  <button key={f.url} onClick={() => setFotoAtiva(i)}
                    className="w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors"
                    style={{ borderColor: i === fotoAtiva ? ROXO : 'transparent' }}>
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              {/* carrossel swipeable — mobile */}
              <div className="flex sm:hidden gap-2 mt-3 overflow-x-auto scrollbar-none" style={{ scrollSnapType: 'x mandatory' }}>
                {produto.fotos.map((f, i) => (
                  <button key={f.url} onClick={() => setFotoAtiva(i)}
                    className="w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0"
                    style={{ borderColor: i === fotoAtiva ? ROXO : 'transparent', scrollSnapAlign: 'start' }}>
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* info + acao */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: PRETO }}>{produto.nome}</h1>
          <Link to={`/marketplace/parceiro/${produto.parceiro_slug}`} className="text-sm text-slate-500 hover:underline mt-1.5 inline-block">
            {produto.parceiro_nome}
          </Link>

          <div className="mt-5">
            {temPrecoAssociado && ehAssociado ? (
              <div>
                <p className="text-slate-400 text-lg line-through">{formatarPreco(produto.preco)}</p>
                <p className="text-4xl font-extrabold" style={{ color: ROXO }}>{formatarPreco(produto.preco_associado)}</p>
                <span className="inline-block mt-2 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                  Desconto exclusivo associado
                </span>
                <p className="text-sm font-semibold mt-2" style={{ color: '#166534' }}>Você está economizando {formatarPreco(economia)}!</p>
              </div>
            ) : temPrecoAssociado ? (
              <div>
                <p className="text-4xl font-extrabold" style={{ color: PRETO }}>{formatarPreco(produto.preco)}</p>
                <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
                  <p className="text-sm font-bold" style={{ color: '#92700C' }}>
                    💎 Associados SECI: {formatarPreco(produto.preco_associado)} <span className="font-normal">(economize {formatarPreco(economia)})</span>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link to="/meu-painel" className="text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO_ESCURO }}>
                      Sou associado — Fazer login
                    </Link>
                    <Link to="/cadastrar" className="text-xs font-semibold px-4 py-2 rounded-xl border" style={{ borderColor: DOURADO, color: '#92700C' }}>
                      Quero ser associado
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-4xl font-extrabold" style={{ color: PRETO }}>{formatarPreco(produto.preco)}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-5">
            {produto.categoria && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500">{produto.categoria}</span>}
            {produto.marca && <span className="text-xs text-slate-500">Marca: <strong className="text-slate-700">{produto.marca}</strong></span>}
          </div>

          <p className="text-xs font-semibold mt-3" style={{ color: produto.estoque_disponivel ? '#166534' : '#991B1B' }}>
            {produto.estoque_disponivel ? '● Disponível' : '● Indisponível no momento'}
          </p>

          {/* CTA whatsapp — inline (desktop / mobile no fluxo normal) */}
          <button
            type="button"
            onClick={handleWhatsappClick}
            disabled={!whatsappHabilitado || carregandoWhatsapp}
            className={`mt-6 w-full flex items-center justify-center gap-2 text-white font-bold text-base py-4 rounded-xl transition-all duration-300 ease-out ${whatsappHabilitado ? 'hover:-translate-y-0.5 hover:shadow-xl cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
            style={{ backgroundColor: '#25D366', boxShadow: whatsappHabilitado ? `0 4px 20px ${DOURADO}33` : 'none' }}
          >
            {carregandoWhatsapp ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
            Chamar no WhatsApp
          </button>

          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => alternarFavorito(produto.id)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              <Heart className="w-4 h-4" style={{ color: favorito ? '#EF4444' : undefined }} fill={favorito ? '#EF4444' : 'none'} /> Favoritar
            </button>
            <button onClick={handleCompartilhar} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              <Share2 className="w-4 h-4" /> Compartilhar
            </button>
          </div>

          {/* descricao */}
          <div className="mt-8">
            <h2 className="font-bold text-sm mb-2" style={{ color: PRETO }}>Descrição do produto</h2>
            <p className={`text-slate-600 text-sm whitespace-pre-line leading-relaxed ${!descricaoExpandida && descricaoLonga ? 'line-clamp-3' : ''}`}>
              {produto.descricao}
            </p>
            {descricaoLonga && (
              <button onClick={() => setDescricaoExpandida(v => !v)} className="text-xs font-semibold mt-1" style={{ color: ROXO }}>
                {descricaoExpandida ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* sobre o parceiro */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: `${produto.parceiro_cor_icone}22` }}>
            {produto.parceiro_logo_url ? <img src={produto.parceiro_logo_url} alt="" className="w-full h-full object-cover" /> : produto.parceiro_icone}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{produto.parceiro_nome}</p>
            <p className="text-slate-500 text-xs mt-0.5">{produto.parceiro_categoria}</p>
            {produto.parceiro_endereco && (
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {produto.parceiro_bairro ? `${produto.parceiro_bairro}, ` : ''}{produto.parceiro_cidade}</p>
            )}
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3 h-3" style={{ color: DOURADO }} fill={DOURADO} />)}
              <span className="text-[10px] text-slate-400 ml-1">4.9</span>
            </div>
          </div>
          <Link to={`/marketplace/parceiro/${produto.parceiro_slug}`} className="text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: ROXO }}>
            Ver perfil completo →
          </Link>
        </div>
      </div>

      {/* outros produtos */}
      {outros.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-8">
          <h2 className="font-bold text-base mb-4" style={{ color: PRETO }}>Mais deste parceiro</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {outros.map(p => (
              <Link key={p.id} to={`/marketplace/produto/${p.id}`} className="w-36 flex-shrink-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="aspect-square bg-slate-50 flex items-center justify-center">
                  {p.fotos?.[0]?.url ? <img src={p.fotos[0].url} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-5 h-5 text-slate-300" />}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold truncate" style={{ color: PRETO }}>{p.nome}</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: ROXO }}>{formatarPreco(p.preco)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* cta rodape */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-10">
        <div className="rounded-2xl p-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
          <p className="font-bold text-lg">Ainda não é associado SECI?</p>
          <p className="text-white/80 text-sm mt-1">Faça sua carteirinha grátis e economize em todos os parceiros!</p>
          <Link to="/cadastrar" className="inline-block mt-4 text-sm font-bold px-6 py-3 rounded-xl" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
            Fazer minha carteirinha
          </Link>
        </div>
      </div>

      {/* whatsapp fixo mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-100 z-40">
        <button
          type="button"
          onClick={handleWhatsappClick}
          disabled={!whatsappHabilitado || carregandoWhatsapp}
          className={`w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-3.5 rounded-xl ${whatsappHabilitado ? '' : 'opacity-50'}`}
          style={{ backgroundColor: '#25D366' }}
        >
          {carregandoWhatsapp ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <MessageCircle className="w-4.5 h-4.5" />}
          Chamar no WhatsApp
        </button>
      </div>
    </div>
  );
}

function ProdutoSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
      <div className="aspect-square rounded-2xl bg-slate-100" />
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded-lg w-3/4" />
        <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
        <div className="h-10 bg-slate-100 rounded-lg w-1/2 mt-6" />
        <div className="h-14 bg-slate-100 rounded-xl w-full mt-6" />
      </div>
    </div>
  );
}

function Produto404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <PackageX className="w-10 h-10 text-slate-300" />
      <p className="font-bold text-lg" style={{ color: PRETO }}>Produto não encontrado</p>
      <p className="text-slate-500 text-sm max-w-xs">Esse produto não existe mais ou não está mais disponível.</p>
      <Link to="/marketplace" className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
        Voltar pro Marketplace
      </Link>
    </div>
  );
}

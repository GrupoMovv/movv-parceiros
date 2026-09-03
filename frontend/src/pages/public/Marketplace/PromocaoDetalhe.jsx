import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight, Share2, Star, MapPin, MessageCircle, ImageOff, Loader2, PackageX, Timer,
} from 'lucide-react';
import api from '../../../services/api';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Timer grande com segundos — só faz sentido rodar aqui, na página
// dedicada; no card da vitrine isso viraria ruído de re-render constante.
function useContagemDetalhada(dataFim) {
  const [restante, setRestante] = useState(null);

  useEffect(() => {
    function calcular() {
      const ms = new Date(dataFim).getTime() - Date.now();
      if (ms <= 0) { setRestante({ expirado: true }); return; }
      setRestante({
        expirado: false,
        horas: Math.floor(ms / 3.6e6),
        min: Math.floor((ms % 3.6e6) / 60000),
        seg: Math.floor((ms % 60000) / 1000),
      });
    }
    calcular();
    const interval = setInterval(calcular, 1000);
    return () => clearInterval(interval);
  }, [dataFim]);

  return restante;
}

export default function PromocaoDetalhe() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const associadoHash = searchParams.get('associado');

  const [promocao, setPromocao] = useState(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [erroRede, setErroRede] = useState(false);
  const [nomeAssociado, setNomeAssociado] = useState(null);
  const [carregandoWhatsapp, setCarregandoWhatsapp] = useState(false);

  const ehAssociado = Boolean(nomeAssociado);

  function carregarPromocao() {
    setErroRede(false);
    setNaoEncontrada(false);
    api.get(`/public/promocoes/${id}`)
      .then(res => setPromocao(res.data))
      .catch(err => {
        if (err.response?.status === 404) setNaoEncontrada(true);
        else setErroRede(true);
      });
  }

  useEffect(() => { carregarPromocao(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!promocao) return;
    document.title = `${promocao.titulo} — ${promocao.parceiro_nome} | IUB MAIS`;
    api.post(`/public/promocoes/${id}/visualizacao`, { tipo: 'ver_promocao', associado_hash: associadoHash }).catch(() => {});
  }, [promocao, id, associadoHash]);

  const contagem = useContagemDetalhada(promocao?.data_fim);
  const urgente = contagem && !contagem.expirado && contagem.horas < 24;

  const mensagemFallback = useMemo(() => {
    if (!promocao) return '';
    return `Olá! Vi a promoção "${promocao.titulo}" no IUB MAIS e tenho interesse. Ainda dá tempo de garantir?`;
  }, [promocao]);

  async function handleWhatsappClick() {
    if (carregandoWhatsapp || !promocao?.parceiro_whatsapp) return;
    const novaAba = window.open('', '_blank');
    setCarregandoWhatsapp(true);
    try {
      const res = await api.get(`/public/promocoes/${id}/mensagem-whatsapp`, {
        params: associadoHash ? { associado: associadoHash } : {},
      });
      if (novaAba) novaAba.location.href = res.data.url_final;
      else window.open(res.data.url_final, '_blank');
    } catch {
      const fallback = linkWhatsappComTexto(promocao.parceiro_whatsapp, mensagemFallback);
      if (novaAba) novaAba.location.href = fallback;
      else window.open(fallback, '_blank');
    } finally {
      setCarregandoWhatsapp(false);
    }
    api.post(`/public/promocoes/${id}/visualizacao`, { tipo: 'clique_whatsapp', associado_hash: associadoHash }).catch(() => {});
  }

  async function handleCompartilhar() {
    const url = window.location.href;
    const texto = urgente ? `Corre! Promo termina em ${contagem.horas}h! ${mensagemFallback}` : mensagemFallback;
    if (navigator.share) {
      try { await navigator.share({ title: promocao.titulo, text: texto, url }); } catch { /* usuário cancelou */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copiado!');
      } catch { /* clipboard indisponível */ }
    }
  }

  if (naoEncontrada) return <Promocao404 />;

  if (erroRede) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-500 text-sm text-center">Não foi possível carregar essa promoção agora.</p>
        <button onClick={carregarPromocao} className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!promocao) return <PromocaoSkeleton />;

  const whatsappHabilitado = Boolean(promocao.parceiro_whatsapp);
  const temPrecoAssociado = Boolean(promocao.preco_associado);
  const economia = parseFloat(promocao.preco_de) - parseFloat(promocao.preco_por);
  const descontoPct = Math.round((economia / parseFloat(promocao.preco_de)) * 100);

  const inicio = new Date(promocao.data_inicio).getTime();
  const fim = new Date(promocao.data_fim).getTime();
  const progressoPct = Math.min(100, Math.max(0, ((Date.now() - inicio) / (fim - inicio)) * 100));
  const vagasRestantes = promocao.limite_usos ? promocao.limite_usos - promocao.usos_atuais : null;
  const esgotada = vagasRestantes !== null && vagasRestantes <= 0;
  const expirada = contagem?.expirado && Date.now() > fim;

  return (
    <div className="min-h-screen w-full bg-white pb-24 sm:pb-10">
      {/* breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-5 flex items-center gap-1 text-xs text-slate-400 flex-wrap">
        <Link to="/marketplace" className="hover:underline">Home</Link>
        {promocao.categoria && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span>{promocao.categoria}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium truncate">{promocao.titulo}</span>
      </div>

      {/* faixa de urgência */}
      {urgente && !expirada && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-4">
          <div className="rounded-2xl p-4 sm:p-5 text-center text-white" style={{ background: `linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)` }}>
            <p className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wide">
              <Timer className="w-4 h-4" /> Corre, tá acabando!
            </p>
            <p className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
              {String(contagem.horas).padStart(2, '0')}h {String(contagem.min).padStart(2, '0')}m {String(contagem.seg).padStart(2, '0')}s
            </p>
          </div>
        </div>
      )}
      {expirada && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-4">
          <div className="rounded-2xl p-4 text-center bg-slate-100 text-slate-500 text-sm font-semibold">
            Essa promoção já encerrou.
          </div>
        </div>
      )}
      {esgotada && !expirada && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-4">
          <div className="rounded-2xl p-4 text-center bg-slate-100 text-slate-500 text-sm font-semibold">
            As vagas dessa promoção esgotaram.
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* foto */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50">
            {promocao.foto_url ? (
              <img src={promocao.foto_url} alt={promocao.titulo} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <ImageOff className="w-10 h-10" />
                <p className="text-xs mt-2">Sem foto</p>
              </div>
            )}
            <span className="absolute top-3 left-3 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide shadow-sm" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              {descontoPct}% OFF
            </span>
            {promocao.exclusivo_associado && (
              <span className="absolute top-3 right-3 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide shadow-sm text-white" style={{ backgroundColor: ROXO }}>
                💎 SECI
              </span>
            )}
          </div>

          {/* barra de progresso da vigência */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progressoPct}%`, backgroundColor: progressoPct > 80 ? '#DC2626' : ROXO }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {expirada ? 'Promoção encerrada' : `Válida até ${new Date(promocao.data_fim).toLocaleDateString('pt-BR')} às ${new Date(promocao.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        {/* info + acao */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: PRETO }}>{promocao.titulo}</h1>
          <Link to={`/marketplace/parceiro/${promocao.parceiro_slug}`} className="text-sm text-slate-500 hover:underline mt-1.5 inline-block">
            {promocao.parceiro_nome}
          </Link>

          <div className="mt-5">
            <p className="text-slate-400 text-lg line-through">{formatarPreco(promocao.preco_de)}</p>
            <p className="text-4xl font-extrabold" style={{ color: ROXO }}>{formatarPreco(promocao.preco_por)}</p>
            <p className="text-sm font-semibold mt-2" style={{ color: '#166534' }}>Você economiza {formatarPreco(economia)}!</p>

            {temPrecoAssociado && (
              <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
                <p className="text-sm font-bold" style={{ color: '#92700C' }}>
                  💎 Associados SECI: {formatarPreco(promocao.preco_associado)}
                </p>
                {!ehAssociado && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link to="/meu-painel" className="text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO_ESCURO }}>
                      Sou associado — Fazer login
                    </Link>
                    <Link to="/cadastrar" className="text-xs font-semibold px-4 py-2 rounded-xl border" style={{ borderColor: DOURADO, color: '#92700C' }}>
                      Quero ser associado
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {vagasRestantes !== null && !esgotada && (
            <p className="text-xs font-bold mt-4" style={{ color: '#B91C1C' }}>
              🔥 Faltam só {vagasRestantes} {vagasRestantes === 1 ? 'vaga' : 'vagas'}! ({promocao.usos_atuais}/{promocao.limite_usos} já garantiram)
            </p>
          )}

          {promocao.categoria && (
            <span className="inline-block mt-4 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500">{promocao.categoria}</span>
          )}

          <button
            type="button"
            onClick={handleWhatsappClick}
            disabled={!whatsappHabilitado || carregandoWhatsapp || esgotada || expirada}
            className={`mt-6 w-full flex items-center justify-center gap-2 text-white font-bold text-base py-4 rounded-xl transition-all duration-300 ease-out ${whatsappHabilitado && !esgotada && !expirada ? 'hover:-translate-y-0.5 hover:shadow-xl cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
            style={{ backgroundColor: '#25D366', boxShadow: whatsappHabilitado ? `0 4px 20px ${DOURADO}33` : 'none' }}
          >
            {carregandoWhatsapp ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
            {esgotada ? 'Vagas esgotadas' : expirada ? 'Promoção encerrada' : 'Chamar no WhatsApp'}
          </button>

          <button onClick={handleCompartilhar} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 mt-3">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>

          {promocao.descricao && (
            <div className="mt-8">
              <h2 className="font-bold text-sm mb-2" style={{ color: PRETO }}>Sobre a promoção</h2>
              <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">{promocao.descricao}</p>
            </div>
          )}
        </div>
      </div>

      {/* sobre o parceiro */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: `${promocao.parceiro_cor_icone}22` }}>
            {promocao.parceiro_logo_url ? <img src={promocao.parceiro_logo_url} alt="" className="w-full h-full object-cover" /> : promocao.parceiro_icone}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{promocao.parceiro_nome}</p>
            <p className="text-slate-500 text-xs mt-0.5">{promocao.parceiro_categoria}</p>
            {promocao.parceiro_endereco && (
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {promocao.parceiro_bairro ? `${promocao.parceiro_bairro}, ` : ''}{promocao.parceiro_cidade}</p>
            )}
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3 h-3" style={{ color: DOURADO }} fill={DOURADO} />)}
              <span className="text-[10px] text-slate-400 ml-1">4.9</span>
            </div>
          </div>
          <Link to={`/marketplace/parceiro/${promocao.parceiro_slug}`} className="text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: ROXO }}>
            Ver perfil completo →
          </Link>
        </div>
      </div>

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
          disabled={!whatsappHabilitado || carregandoWhatsapp || esgotada || expirada}
          className={`w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-3.5 rounded-xl ${whatsappHabilitado && !esgotada && !expirada ? '' : 'opacity-50'}`}
          style={{ backgroundColor: '#25D366' }}
        >
          {carregandoWhatsapp ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <MessageCircle className="w-4.5 h-4.5" />}
          {esgotada ? 'Vagas esgotadas' : expirada ? 'Promoção encerrada' : 'Chamar no WhatsApp'}
        </button>
      </div>
    </div>
  );
}

function PromocaoSkeleton() {
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

function Promocao404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <PackageX className="w-10 h-10 text-slate-300" />
      <p className="font-bold text-lg" style={{ color: PRETO }}>Promoção não encontrada</p>
      <p className="text-slate-500 text-sm max-w-xs">Essa promoção não existe mais ou não está mais disponível.</p>
      <Link to="/marketplace" className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
        Voltar pro Marketplace
      </Link>
    </div>
  );
}

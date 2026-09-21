import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MapPin, Tag, CalendarCheck, ImageOff, ShoppingCart, Check } from 'lucide-react';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { DIAS, formatarBRL, horarioConfigurado, statusFuncionamento, textoTaxaEntrega, textoTempoPreparo } from '../../../utils/iubFood';
import { useCarrinho } from './CarrinhoContext';
import SeloPlano from './components/SeloPlano';
import { ROXO, ROXO_ESCURO, DOURADO, GRAFITE } from './theme';

// Recalcula aberto/fechado sozinho — cliente que deixa a página aberta
// esperando o restaurante abrir vê o botão liberar sem recarregar.
function useAgora(intervaloMs = 60 * 1000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

// Página individual de um restaurante (/food/:slug) — clone estrutural de
// ServicoDetalhe.jsx (mesmo header/CTA fixo), mas o "cardápio" mostra foto
// + descrição de cada item (getFoodPorSlug já devolve isso), diferente da
// lista simples nome+preço dos "serviços oferecidos" — faz sentido mostrar
// foto de prato, não faz sentido mostrar foto de "consulta".
export default function FoodDetalhe() {
  const { slug } = useParams();
  const [restaurante, setRestaurante] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const agora = useAgora();
  const { adicionar, remover, estaNoCarrinho, totalItens } = useCarrinho();

  useEffect(() => {
    setCarregando(true);
    setNaoEncontrado(false);
    api.get(`/public/food/${slug}`)
      .then(res => setRestaurante(res.data))
      .catch(err => { if (err.response?.status === 404) setNaoEncontrado(true); })
      .finally(() => setCarregando(false));
  }, [slug]);

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  if (naoEncontrado || !restaurante) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-bold text-lg" style={{ color: GRAFITE }}>Restaurante não encontrado</p>
        <Link to="/marketplace/food" className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
          Ver IUB Food
        </Link>
      </div>
    );
  }

  const tipo = restaurante.categoria_principal || restaurante.categorias?.[0] || null;
  const temEndereco = Boolean(restaurante.endereco || restaurante.bairro);
  const enderecoCompleto = [restaurante.endereco, restaurante.bairro, restaurante.cidade].filter(Boolean).join(', ');
  const descricao = restaurante.descricao_completa || restaurante.descricao;
  const mensagemWppBase = `Olá! Vi o ${restaurante.nome} no IUB MAIS+ e quero fazer um pedido.`;
  const linkWppBase = restaurante.whatsapp ? linkWhatsappComTexto(restaurante.whatsapp, mensagemWppBase) : null;
  const foto = restaurante.fotos_estabelecimento?.[0]?.url || restaurante.logo_url;

  // null = restaurante ainda não configurou horário: não mostra badge nem
  // bloqueia pedido (não dá pra afirmar que está fechado).
  const status = statusFuncionamento(restaurante.horario_funcionamento, agora);
  const tempo = textoTempoPreparo(restaurante);
  // retirada_disponivel nasce true pra todo mundo (DEFAULT da migration
  // 051) — só afirma "Retirada disponível" pra quem já mexeu na tela de
  // Entrega/horários, senão seria dado que o restaurante nunca informou.
  const configurouAtendimento = restaurante.delivery_disponivel || restaurante.tempo_preparo_min != null || horarioConfigurado(restaurante.horario_funcionamento);

  function botaoItem(item) {
    if (item.estoque_disponivel === false) return { desabilitado: true, texto: 'Esgotado' };
    if (status && !status.aberto) return { desabilitado: true, texto: `Fechado · abre ${status.proximaAbertura}` };
    if (estaNoCarrinho(item.id)) return { noCarrinho: true, texto: 'No carrinho' };
    return { texto: 'Adicionar ao carrinho' };
  }

  return (
    <div className="min-h-screen w-full bg-white pb-28">
      <div className="relative px-6 pt-8 pb-14 text-center overflow-hidden" style={{ background: `linear-gradient(150deg, ${ROXO_ESCURO} 0%, ${ROXO} 130%)` }}>
        <Link to="/marketplace/food" className="relative inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao IUB Food
        </Link>

        <div className="relative flex items-center justify-center gap-2 flex-wrap mb-3">
          <SeloPlano plano={restaurante.plano} size="lg" />
        </div>

        <div className="relative w-24 h-24 rounded-3xl mx-auto shadow-2xl bg-white overflow-hidden flex items-center justify-center">
          {foto ? (
            <img src={foto} alt={restaurante.nome} className="w-full h-full object-cover" />
          ) : (
            <ImageOff className="w-8 h-8 text-slate-200" />
          )}
        </div>

        <h1 className="relative text-white font-black text-xl sm:text-3xl mt-4">{restaurante.nome}</h1>
        {tipo && (
          <p className="relative text-white/70 text-xs font-semibold uppercase tracking-wide mt-1.5 flex items-center justify-center gap-1">
            <Tag className="w-3 h-3" /> {tipo}
          </p>
        )}

        {status && (
          <p className="relative inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mt-3"
            style={{ backgroundColor: status.aberto ? '#DCFCE7' : '#FEE2E2', color: status.aberto ? '#166534' : '#991B1B' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.aberto ? '#16A34A' : '#DC2626' }} />
            {status.texto}
          </p>
        )}

        {configurouAtendimento && (
          <div className="relative flex items-center justify-center gap-2 flex-wrap mt-3">
            {restaurante.delivery_disponivel && <ChipHeader>🚚 {textoTaxaEntrega(restaurante)}</ChipHeader>}
            {restaurante.retirada_disponivel && <ChipHeader>🏪 Retirada disponível</ChipHeader>}
            {tempo && <ChipHeader>⏱️ Pronto em {tempo}</ChipHeader>}
          </div>
        )}
        {!configurouAtendimento && tempo && (
          <div className="relative flex justify-center mt-3"><ChipHeader>⏱️ {tempo}</ChipHeader></div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {restaurante.preco_medio && (
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
            <p className="text-xs font-semibold text-slate-500">Ticket médio</p>
            <p className="text-xl font-black mt-0.5" style={{ color: '#92700C' }}>{restaurante.preco_medio}</p>
          </div>
        )}

        {descricao && (
          <div>
            <h2 className="font-bold text-sm mb-2" style={{ color: GRAFITE }}>Sobre</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{descricao}</p>
          </div>
        )}

        {horarioConfigurado(restaurante.horario_funcionamento) ? (
          <div className="flex items-start gap-2">
            <CalendarCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 mb-1">Horário de funcionamento</p>
              <ul className="text-sm space-y-0.5" style={{ color: GRAFITE }}>
                {DIAS.map(d => {
                  const info = restaurante.horario_funcionamento[d.chave];
                  return (
                    <li key={d.chave} className="flex justify-between max-w-[260px]">
                      <span>{d.label}</span>
                      <span className={info?.aberto ? '' : 'text-slate-400'}>{info?.aberto ? `${info.abre} – ${info.fecha}` : 'Fechado'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : restaurante.horario_atendimento && (
          <div className="flex items-start gap-2">
            <CalendarCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div>
              <p className="text-xs font-semibold text-slate-500">Horário de funcionamento</p>
              <p className="text-sm" style={{ color: GRAFITE }}>{restaurante.horario_atendimento}</p>
            </div>
          </div>
        )}

        {temEndereco && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div>
              <p className="text-xs font-semibold text-slate-500">Endereço</p>
              <p className="text-sm" style={{ color: GRAFITE }}>{enderecoCompleto}</p>
              {restaurante.delivery_disponivel && restaurante.raio_entrega_km && (
                <p className="text-xs text-slate-400 mt-0.5">Entrega em até {parseFloat(restaurante.raio_entrega_km).toLocaleString('pt-BR')} km</p>
              )}
            </div>
          </div>
        )}

        {restaurante.cardapio.length > 0 && (
          <div>
            <h2 className="font-bold text-sm mb-3" style={{ color: GRAFITE }}>Cardápio</h2>
            <div className="grid grid-cols-2 gap-3">
              {restaurante.cardapio.map(item => {
                const fotoItem = item.fotos?.[0]?.url;
                const botao = botaoItem(item);
                return (
                  <div key={item.id} className="rounded-xl p-2 bg-slate-50 flex flex-col">
                    <div className="w-full h-[90px] rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                      {fotoItem ? (
                        <img src={fotoItem} alt={item.nome} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="w-6 h-6 text-slate-200" />
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-snug line-clamp-2 mt-1.5" style={{ color: GRAFITE }}>{item.nome}</p>
                    {item.descricao && <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{item.descricao}</p>}
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <p className="text-sm font-black" style={{ color: ROXO_ESCURO }}>{formatarBRL(item.preco_associado ?? item.preco)}</p>
                      {item.tempo_preparo_min && <p className="text-[10px] text-slate-400">⏱️ ~{item.tempo_preparo_min} min</p>}
                    </div>
                    <div className="mt-auto pt-2">
                      <button
                        type="button"
                        disabled={botao.desabilitado}
                        onClick={() => (botao.noCarrinho ? remover(item.id) : adicionar(item.id))}
                        className={`w-full flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 px-1 rounded-lg border transition-colors ${
                          botao.desabilitado ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
                            : botao.noCarrinho ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'bg-white hover:bg-purple-50'
                        }`}
                        style={botao.desabilitado || botao.noCarrinho ? undefined : { borderColor: ROXO, color: ROXO }}
                      >
                        {botao.noCarrinho ? <Check className="w-3 h-3" /> : !botao.desabilitado && <ShoppingCart className="w-3 h-3" />}
                        {botao.texto}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA fixo embaixo, igual ServicoDetalhe — sempre acessível sem
          precisar rolar de volta pro topo. Com item no carrinho, o atalho
          pro carrinho vem primeiro (é de lá que sai o pedido agrupado). */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex gap-2 w-full max-w-2xl mx-auto">
          {totalItens > 0 && (
            <Link
              to="/marketplace/carrinho"
              className="flex items-center justify-center gap-2 flex-1 text-sm sm:text-base font-black px-4 py-3.5 rounded-2xl text-white shadow-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: ROXO }}
            >
              <ShoppingCart className="w-5 h-5" /> Carrinho ({totalItens})
            </Link>
          )}
          {linkWppBase ? (
            <a
              href={linkWppBase}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 flex-1 text-sm sm:text-base font-black px-4 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
            >
              <MessageCircle className="w-5 h-5" /> {totalItens > 0 ? 'WHATSAPP' : '📱 PEDIR VIA WHATSAPP'}
            </a>
          ) : (
            <p className="flex-1 text-center text-xs text-slate-400 py-3">WhatsApp em breve pra esse restaurante.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipHeader({ children }) {
  return <span className="text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 text-white backdrop-blur-sm">{children}</span>;
}

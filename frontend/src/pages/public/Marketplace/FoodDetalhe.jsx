import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MapPin, Clock, Tag, CalendarCheck, ImageOff } from 'lucide-react';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import SeloPlano from './components/SeloPlano';
import { ROXO, ROXO_ESCURO, DOURADO, GRAFITE } from './theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  function linkWppItem(item) {
    if (!restaurante.whatsapp) return null;
    return linkWhatsappComTexto(restaurante.whatsapp, `Olá! Vi o ${item.nome} do ${restaurante.nome} no IUB MAIS+ e quero pedir.`);
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
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {(restaurante.preco_medio || restaurante.duracao_media) && (
          <div className="grid grid-cols-2 gap-3">
            {restaurante.preco_medio && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
                <p className="text-xs font-semibold text-slate-500">Ticket médio</p>
                <p className="text-xl font-black mt-0.5" style={{ color: '#92700C' }}>{restaurante.preco_medio}</p>
              </div>
            )}
            {restaurante.duracao_media && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${ROXO}10`, border: `1px solid ${ROXO}30` }}>
                <p className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Entrega</p>
                <p className="text-xl font-black mt-0.5" style={{ color: ROXO_ESCURO }}>{restaurante.duracao_media}</p>
              </div>
            )}
          </div>
        )}

        {descricao && (
          <div>
            <h2 className="font-bold text-sm mb-2" style={{ color: GRAFITE }}>Sobre</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{descricao}</p>
          </div>
        )}

        {restaurante.horario_atendimento && (
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
            </div>
          </div>
        )}

        {restaurante.cardapio.length > 0 && (
          <div>
            <h2 className="font-bold text-sm mb-3" style={{ color: GRAFITE }}>Cardápio</h2>
            <div className="grid grid-cols-2 gap-3">
              {restaurante.cardapio.map(item => {
                const fotoItem = item.fotos?.[0]?.url;
                const wppItem = linkWppItem(item);
                const conteudo = (
                  <>
                    <div className="w-full h-[90px] rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                      {fotoItem ? (
                        <img src={fotoItem} alt={item.nome} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="w-6 h-6 text-slate-200" />
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-snug line-clamp-2 mt-1.5" style={{ color: GRAFITE }}>{item.nome}</p>
                    {item.descricao && <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{item.descricao}</p>}
                    <p className="text-sm font-black mt-1" style={{ color: ROXO_ESCURO }}>
                      {formatarPreco(item.preco_associado ?? item.preco)}
                    </p>
                  </>
                );
                return wppItem ? (
                  <a key={item.id} href={wppItem} target="_blank" rel="noreferrer" className="rounded-xl p-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                    {conteudo}
                  </a>
                ) : (
                  <div key={item.id} className="rounded-xl p-2 bg-slate-50">{conteudo}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA fixo embaixo, igual ServicoDetalhe — sempre acessível sem
          precisar rolar de volta pro topo. */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {linkWppBase ? (
          <a
            href={linkWppBase}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full max-w-2xl mx-auto text-sm sm:text-base font-black px-6 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            <MessageCircle className="w-5 h-5" /> 📱 PEDIR VIA WHATSAPP
          </a>
        ) : (
          <p className="text-center text-xs text-slate-400 py-3">WhatsApp em breve pra esse restaurante.</p>
        )}
      </div>
    </div>
  );
}

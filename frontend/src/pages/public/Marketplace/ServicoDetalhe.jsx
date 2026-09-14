import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MapPin, Clock, Tag, CalendarCheck, ImageOff } from 'lucide-react';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import SeloPlano from './components/SeloPlano';
import { ROXO, ROXO_ESCURO, DOURADO, GRAFITE } from './theme';

// Página individual de um serviço — 100% banco real (sindicato_parceiros
// + sindicato_parceiro_produtos como "serviços oferecidos"), diferente
// de ParceiroDetalhe.jsx (que ainda é Fase 1 estática, ver TODO.md).
// CTA é "Agendar", não "Comprar" — reflete que é hora marcada, não SKU
// com preço fixo/estoque.
export default function ServicoDetalhe() {
  const { slug } = useParams();
  const [servico, setServico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setNaoEncontrado(false);
    api.get(`/public/servicos/${slug}`)
      .then(res => setServico(res.data))
      .catch(err => { if (err.response?.status === 404) setNaoEncontrado(true); })
      .finally(() => setCarregando(false));
  }, [slug]);

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  if (naoEncontrado || !servico) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-bold text-lg" style={{ color: GRAFITE }}>Serviço não encontrado</p>
        <Link to="/marketplace/servicos" className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
          Ver todos os serviços
        </Link>
      </div>
    );
  }

  const categoria = servico.categoria_principal || servico.categorias?.[0] || null;
  const temEndereco = Boolean(servico.endereco || servico.bairro);
  const enderecoCompleto = [servico.endereco, servico.bairro, servico.cidade].filter(Boolean).join(', ');
  const descricao = servico.descricao_completa || servico.descricao;
  const mensagemWpp = `Olá! Vi o ${servico.nome} no IUB MAIS+ e gostaria de agendar um horário.`;
  const linkWpp = servico.whatsapp ? linkWhatsappComTexto(servico.whatsapp, mensagemWpp) : null;
  const foto = servico.fotos_estabelecimento?.[0]?.url || servico.logo_url;

  return (
    <div className="min-h-screen w-full bg-white pb-28">
      <div className="relative px-6 pt-8 pb-14 text-center overflow-hidden" style={{ background: `linear-gradient(150deg, ${ROXO_ESCURO} 0%, ${ROXO} 130%)` }}>
        <Link to="/marketplace/servicos" className="relative inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos serviços
        </Link>

        <div className="relative flex items-center justify-center gap-2 flex-wrap mb-3">
          <SeloPlano plano={servico.plano} size="lg" />
        </div>

        <div className="relative w-24 h-24 rounded-3xl mx-auto shadow-2xl bg-white overflow-hidden flex items-center justify-center">
          {foto ? (
            <img src={foto} alt={servico.nome} className="w-full h-full object-cover" />
          ) : (
            <ImageOff className="w-8 h-8 text-slate-200" />
          )}
        </div>

        <h1 className="relative text-white font-black text-xl sm:text-3xl mt-4">{servico.nome}</h1>
        {categoria && (
          <p className="relative text-white/70 text-xs font-semibold uppercase tracking-wide mt-1.5 flex items-center justify-center gap-1">
            <Tag className="w-3 h-3" /> {categoria}
          </p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {(servico.preco_medio || servico.duracao_media) && (
          <div className="grid grid-cols-2 gap-3">
            {servico.preco_medio && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
                <p className="text-xs font-semibold text-slate-500">Preço médio</p>
                <p className="text-xl font-black mt-0.5" style={{ color: '#92700C' }}>{servico.preco_medio}</p>
              </div>
            )}
            {servico.duracao_media && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${ROXO}10`, border: `1px solid ${ROXO}30` }}>
                <p className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Duração</p>
                <p className="text-xl font-black mt-0.5" style={{ color: ROXO_ESCURO }}>{servico.duracao_media}</p>
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

        {servico.modalidades && (
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div>
              <p className="text-xs font-semibold text-slate-500">Modalidades</p>
              <p className="text-sm" style={{ color: GRAFITE }}>{servico.modalidades}</p>
            </div>
          </div>
        )}

        {servico.horario_atendimento && (
          <div className="flex items-start gap-2">
            <CalendarCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div>
              <p className="text-xs font-semibold text-slate-500">Horário de atendimento</p>
              <p className="text-sm" style={{ color: GRAFITE }}>{servico.horario_atendimento}</p>
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

        {servico.servicos_oferecidos.length > 0 && (
          <div>
            <h2 className="font-bold text-sm mb-3" style={{ color: GRAFITE }}>Serviços oferecidos</h2>
            <ul className="space-y-2">
              {servico.servicos_oferecidos.map(item => (
                <li key={item.id} className="flex items-center justify-between text-sm rounded-xl px-3.5 py-2.5 bg-slate-50">
                  <span style={{ color: GRAFITE }}>{item.nome}</span>
                  {item.preco != null && (
                    <span className="font-bold" style={{ color: ROXO_ESCURO }}>
                      {parseFloat(item.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CTA fixo embaixo — sempre visível pra agendar, sem precisar rolar
          de volta até o topo (mesma ideia de "sempre acessível" que os
          CTAs dos slides do carrossel). */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {linkWpp ? (
          <a
            href={linkWpp}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full max-w-2xl mx-auto text-sm sm:text-base font-black px-6 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            <MessageCircle className="w-5 h-5" /> 📱 AGENDAR VIA WHATSAPP
          </a>
        ) : (
          <p className="text-center text-xs text-slate-400 py-3">WhatsApp em breve pra esse prestador.</p>
        )}
      </div>
    </div>
  );
}

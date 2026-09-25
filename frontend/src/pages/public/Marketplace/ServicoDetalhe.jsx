import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MapPin, Clock, Tag, CalendarCheck, ImageOff } from 'lucide-react';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import SeloPlano from './components/SeloPlano';
import { usePetCatalogo } from '../../../components/PetServicosPicker';
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
  const [agendamento, setAgendamento] = useState({ servico: '', porte: '', raca: '', data: '' });
  const petCatalogo = usePetCatalogo();

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
  const ehPet = Boolean(servico.pet_servicos?.length);
  // Pet shop com atendimento (banho, vet...) já tem o quadro "Agendar pelo
  // WhatsApp" com mensagem detalhada — aí o botão fixo genérico sai.
  // Pet shop só de produtos segue com o botão fixo, falando de produtos.
  const petAtende = ehPet && Boolean(petCatalogo?.servicos.some(s => s.natureza === 'servico' && servico.pet_servicos.includes(s.codigo)));
  const mensagemWpp = petAtende
    ? mensagemAgendamentoPet(servico, agendamento, petCatalogo)
    : ehPet
    ? 'Olá! Vi seu petshop no IUB MAIS+ 🐾\nGostaria de saber sobre os produtos.'
    : `Olá! Vi o ${servico.nome} no IUB MAIS+ e gostaria de agendar um horário.`;
  const linkWpp = servico.whatsapp ? linkWhatsappComTexto(servico.whatsapp, mensagemWpp) : null;
  const voltarPara = ehPet ? '/marketplace/pet' : '/marketplace/servicos';
  const ctaFixo = !(petAtende && linkWpp);
  const foto = servico.fotos_estabelecimento?.[0]?.url || servico.logo_url;

  return (
    <div className={`min-h-screen w-full bg-white ${ctaFixo ? 'pb-28' : 'pb-8'}`}>
      <div className="relative px-6 pt-8 pb-14 text-center overflow-hidden" style={{ background: `linear-gradient(150deg, ${ROXO_ESCURO} 0%, ${ROXO} 130%)` }}>
        <Link to={voltarPara} className="relative inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {ehPet ? 'Voltar aos pet shops' : 'Voltar aos serviços'}
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

        <BlocoPet servico={servico} catalogo={petCatalogo} />

        {ehPet && servico.whatsapp && (
          <AgendarPet servico={servico} catalogo={petCatalogo} valor={agendamento} onChange={setAgendamento} link={linkWpp} />
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
      {ctaFixo && (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {linkWpp ? (
          <a
            href={linkWpp}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full max-w-2xl mx-auto text-sm sm:text-base font-black px-6 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            <MessageCircle className="w-5 h-5" /> {ehPet ? '📱 FALAR COM A LOJA' : '📱 AGENDAR VIA WHATSAPP'}
          </a>
        ) : (
          <p className="text-center text-xs text-slate-400 py-3">WhatsApp em breve pra esse prestador.</p>
        )}
      </div>
      )}
    </div>
  );
}

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nomeDe = (lista, codigo) => lista?.find(x => x.codigo === codigo)?.nome || '';

// Mensagem do "Agendar via WhatsApp" do pet shop — vai se completando com o
// que a pessoa escolheu no card de agendamento (o que não escolheu, fica de fora).
function mensagemAgendamentoPet(servico, a, catalogo) {
  const servicoNome = nomeDe(catalogo?.servicos, a.servico);
  const raca = a.raca === 'srd' ? 'vira-lata (sem raça definida)' : nomeDe(catalogo?.racas, a.raca);
  const porte = nomeDe(catalogo?.portes, a.porte);
  const data = a.data ? a.data.split('-').reverse().join('/') : '';
  if (!servicoNome) return `Olá! Vi seu petshop no IUB MAIS+ 🐾\nGostaria de agendar um horário.`;
  const pet = raca ? `meu ${raca}` : 'meu pet';
  return `Olá! Vi seu petshop no IUB MAIS+ 🐾\nGostaria de agendar ${servicoNome} para ${pet}${porte ? ` (porte ${porte.toLowerCase()})` : ''}${data ? ` no dia ${data}` : ''}.`;
}

// 🐾 Pet shop: o que oferece, portes, raças e tabela de preços (catálogo vem do backend).
function BlocoPet({ servico, catalogo }) {
  const servicos = servico.pet_servicos || [];
  if (!catalogo || !servicos.length) return null;
  const itens = catalogo.servicos.filter(s => servicos.includes(s.codigo));
  const portesTxt = catalogo.portes.filter(p => (servico.pet_portes || []).includes(p.codigo)).map(p => p.nome).join(' · ');
  const racas = catalogo.racas.filter(r => (servico.pet_racas || []).includes(r.codigo)).map(r => r.nome);
  const precos = servico.pet_precos || [];
  const servicosComPreco = catalogo.servicos.filter(s => precos.some(p => p.servico === s.codigo));
  return (
    <div className="space-y-3">
      <h2 className="font-bold text-sm" style={{ color: GRAFITE }}>🐾 Serviços pet</h2>
      <div className="flex flex-wrap gap-2">
        {itens.map(s => (
          <span key={s.codigo} title={s.exemplos.join(', ')} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {s.emoji} {s.nome}
          </span>
        ))}
      </div>
      {portesTxt && <p className="text-xs text-slate-500">Atende portes: <span className="font-semibold text-slate-700">{portesTxt}</span></p>}
      <p className="text-xs text-slate-500">
        {racas.length ? <>Especialista em: <span className="font-semibold text-slate-700">{racas.join(', ')}</span></> : 'Atende todas as raças'}
      </p>
      {servicosComPreco.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          {servicosComPreco.map(s => (
            <div key={s.codigo} className="px-3.5 py-2.5 border-b border-slate-100 last:border-0">
              <p className="text-sm font-semibold" style={{ color: GRAFITE }}>{s.emoji} {s.nome}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {catalogo.portes.filter(p => precos.some(x => x.servico === s.codigo && x.porte === p.codigo)).map(p => (
                  <span key={p.codigo} className="text-xs text-slate-500">
                    {p.nome}: <span className="font-bold" style={{ color: ROXO_ESCURO }}>{brl(precos.find(x => x.servico === s.codigo && x.porte === p.codigo).preco)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Card de agendamento: escolhe serviço, porte, raça e data -> a mensagem do
// WhatsApp já vai pronta ("Gostaria de agendar Banho e Tosa para meu Poodle
// no dia 12/10"). Tudo opcional; o botão de baixo usa a mesma mensagem.
function AgendarPet({ servico, catalogo, valor, onChange, link }) {
  if (!catalogo) return null;
  const opcoesServico = catalogo.servicos.filter(s => s.natureza === 'servico' && servico.pet_servicos.includes(s.codigo));
  if (!opcoesServico.length) return null;
  const opcoesPorte = catalogo.portes.filter(p => (servico.pet_portes || []).includes(p.codigo));
  const set = (campo, v) => onChange({ ...valor, [campo]: v });
  const hoje = new Date().toISOString().slice(0, 10);
  const precoEscolhido = (servico.pet_precos || []).find(p => p.servico === valor.servico && p.porte === valor.porte);
  const sel = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: `${ROXO}08`, border: `1px solid ${ROXO}25` }}>
      <h2 className="font-bold text-sm" style={{ color: GRAFITE }}>📅 Agendar pelo WhatsApp</h2>
      <div className="grid grid-cols-2 gap-2">
        <select className={sel} value={valor.servico} onChange={e => set('servico', e.target.value)} aria-label="Serviço">
          <option value="">Serviço…</option>
          {opcoesServico.map(s => <option key={s.codigo} value={s.codigo}>{s.nome}</option>)}
        </select>
        <select className={sel} value={valor.porte} onChange={e => set('porte', e.target.value)} aria-label="Porte">
          <option value="">Porte…</option>
          {opcoesPorte.map(p => <option key={p.codigo} value={p.codigo}>{p.nome} ({p.faixa})</option>)}
        </select>
        <select className={sel} value={valor.raca} onChange={e => set('raca', e.target.value)} aria-label="Raça">
          <option value="">Raça…</option>
          <option value="srd">Sem raça definida</option>
          {catalogo.racas.map(r => <option key={r.codigo} value={r.codigo}>{r.nome}</option>)}
        </select>
        <input type="date" className={sel} min={hoje} value={valor.data} onChange={e => set('data', e.target.value)} aria-label="Data" />
      </div>
      {precoEscolhido && <p className="text-xs text-slate-600">Preço informado pelo pet shop: <span className="font-bold" style={{ color: ROXO_ESCURO }}>{brl(precoEscolhido.preco)}</span></p>}
      <a href={link} target="_blank" rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full text-sm font-black px-4 py-3 rounded-xl text-white"
        style={{ backgroundColor: '#25D366' }}>
        <MessageCircle className="w-4 h-4" /> Enviar pelo WhatsApp
      </a>
    </div>
  );
}

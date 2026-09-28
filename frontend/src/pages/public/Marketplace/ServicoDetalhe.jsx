import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, MapPin, Clock, Tag, CalendarCheck, ImageOff } from 'lucide-react';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import SeloPlano from './components/SeloPlano';
import { usePetCatalogo } from '../../../components/PetServicosPicker';
import toast from 'react-hot-toast';
import apiPainel from '../../../services/apiPainel';
import { useAssociadoSessao } from './useAssociadoSessao';
import { PERIODOS, nomePeriodo, dataCurta, hojeSP, emojiEspecie } from '../../../utils/pet';
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
  const { associado } = useAssociadoSessao();

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
        <div className="relative text-left -mt-4 mb-2">
          <BotaoVoltar variante="claro" fallback={voltarPara} />
        </div>

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

        {petAtende && <AvaliacoesPet slug={slug} catalogo={petCatalogo} />}

        {/* Pet parte 3: logado pede horário pelo sistema (fica registrado,
            pet shop responde no painel, avisos por WhatsApp); visitante
            continua com a mensagem pronta no WhatsApp da Parte 2. */}
        {petAtende && associado && (
          <PedirHorarioPet servico={servico} slug={slug} catalogo={petCatalogo} />
        )}
        {ehPet && servico.whatsapp && !associado && (
          <AgendarPet servico={servico} catalogo={petCatalogo} valor={agendamento} onChange={setAgendamento} link={linkWpp} voltar={`/servicos/${slug}`} />
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
function AgendarPet({ servico, catalogo, valor, onChange, link, voltar }) {
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
      <p className="text-[11px] text-center text-slate-500">
        Tem conta? <Link to={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="font-bold underline" style={{ color: ROXO }}>Entre</Link> pra pedir o horário por aqui e guardar a ficha do seu pet.
      </p>
    </div>
  );
}

// Pet parte 4 — nota, avaliações (com resposta do pet shop) e galeria
// antes/depois. Só atendimentos reais avaliam; galeria só com ok do dono.
function AvaliacoesPet({ slug, catalogo }) {
  const [dados, setDados] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const [ampliada, setAmpliada] = useState(null);
  useEffect(() => {
    api.get(`/public/pet/parceiros/${slug}/avaliacoes`).then(r => setDados(r.data)).catch(() => setDados(null));
  }, [slug]);
  if (!dados || (!dados.total && !dados.galeria.length)) return null;
  const lista = verTodas ? dados.avaliacoes : dados.avaliacoes.slice(0, 3);
  const estrelas = n => <span aria-label={`${n} de 5`}>{'⭐'.repeat(n)}<span className="text-slate-300">{'★'.repeat(5 - n)}</span></span>;
  return (
    <div className="space-y-4">
      {dados.galeria.length > 0 && (
        <div>
          <h2 className="font-bold text-sm mb-2" style={{ color: GRAFITE }}>📸 Antes e depois</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {dados.galeria.map(g => (
              <div key={g.agendamento_id} className="flex-shrink-0 w-56 rounded-2xl border border-slate-100 p-2">
                <div className="grid grid-cols-2 gap-1">
                  {[['Antes', g.antes[0]], ['Depois', g.depois[0]]].map(([t, url]) => (
                    <button key={t} type="button" disabled={!url} onClick={() => setAmpliada(url)} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                      {url && <img src={url} alt={`${t}: ${g.pet_nome}`} className="w-full h-full object-cover" />}
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-black/60 text-white">{t}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 truncate">{g.pet_nome} · {nomeDe(catalogo?.servicos, g.servico)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {dados.total > 0 && (
        <div>
          <h2 className="font-bold text-sm mb-2" style={{ color: GRAFITE }}>⭐ Avaliações</h2>
          <div className="flex items-center gap-4 rounded-2xl bg-amber-50/60 border border-amber-100 px-4 py-3">
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: GRAFITE }}>{dados.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</p>
              <p className="text-[11px] text-slate-500">{dados.total} {dados.total === 1 ? 'avaliação' : 'avaliações'}</p>
            </div>
            <div className="flex-1 space-y-0.5">
              {[5, 4, 3, 2, 1].map(n => (
                <div key={n} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2">{n}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${(dados.distribuicao[n] / dados.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-3">
            {lista.map(av => (
              <li key={av.id} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-xs">{estrelas(av.nota)} <span className="font-semibold text-slate-700">{av.cliente}</span> <span className="text-slate-400">· {av.pet_nome} · {nomeDe(catalogo?.servicos, av.servico)}</span></p>
                {av.comentario && <p className="text-sm text-slate-700 mt-1">{av.comentario}</p>}
                {av.resposta && <p className="text-xs text-slate-600 mt-1.5 pl-2 border-l-2 border-amber-300"><strong>Resposta do pet shop:</strong> {av.resposta}</p>}
              </li>
            ))}
          </ul>
          {dados.avaliacoes.length > 3 && !verTodas && (
            <button type="button" onClick={() => setVerTodas(true)} className="text-xs font-bold underline" style={{ color: ROXO }}>Ver todas as {dados.avaliacoes.length} avaliações</button>
          )}
        </div>
      )}
      {ampliada && (
        <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4" onClick={() => setAmpliada(null)} role="dialog" aria-modal="true">
          <img src={ampliada} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

// Pet parte 3 — pedido de horário de quem está logado: escolhe o pet (da
// ficha em /meu/pets), serviço, dia e período. Na 1ª vez com este pet shop
// pergunta se compartilha a ficha (LGPD: começa desmarcado, o dono decide).
function PedirHorarioPet({ servico, slug, catalogo }) {
  const [pets, setPets] = useState(null);
  const [f, setF] = useState({ pet_id: '', servico: '', data: '', periodo: '', observacao: '', compartilhar: false });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null); // { agendamento, whatsapp_avisado }

  useEffect(() => {
    apiPainel.get('/public/meus-pets').then(r => {
      setPets(r.data.pets);
      if (r.data.pets.length === 1) setF(x => ({ ...x, pet_id: r.data.pets[0].id }));
    }).catch(() => setPets([]));
  }, []);

  if (!catalogo || pets === null) return null;
  const opcoesServico = catalogo.servicos.filter(s => s.natureza === 'servico' && servico.pet_servicos.includes(s.codigo));
  const portesAtende = servico.pet_portes || [];
  const pet = pets.find(p => p.id === Number(f.pet_id));
  const jaAutorizado = pet?.autorizados.some(a => a.slug === slug);
  const preco = pet?.porte ? (servico.pet_precos || []).find(p => p.servico === f.servico && p.porte === pet.porte) : null;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const caixa = { backgroundColor: `${ROXO}08`, border: `1px solid ${ROXO}25` };
  const sel = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';

  if (enviado) {
    const ag = enviado.agendamento;
    const linkManual = servico.whatsapp
      ? linkWhatsappComTexto(servico.whatsapp, `Olá! Acabei de pedir ${nomeDe(catalogo.servicos, ag.servico)} pro ${ag.pet_nome} pelo IUB MAIS+ (${dataCurta(ag.data)}, ${nomePeriodo(ag.periodo).toLowerCase()}) 🐾`)
      : null;
    return (
      <div className="rounded-2xl p-5 text-center space-y-2" style={caixa}>
        <p className="text-3xl">🎉</p>
        <p className="font-black" style={{ color: GRAFITE }}>Pedido enviado!</p>
        <p className="text-sm text-slate-600">{ag.pet_nome} · {dataCurta(ag.data)}, {nomePeriodo(ag.periodo).toLowerCase()}</p>
        <p className="text-xs text-slate-500">
          {enviado.whatsapp_avisado ? '✅ Avisamos o pet shop pelo WhatsApp. ' : ''}
          Você recebe a resposta pelo WhatsApp e acompanha em Meus Pets.
        </p>
        {!enviado.whatsapp_avisado && linkManual && (
          <a href={linkManual} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white" style={{ backgroundColor: '#25D366' }}>
            <MessageCircle className="w-4 h-4" /> Avisar o pet shop pelo WhatsApp
          </a>
        )}
        <div><Link to="/meu/pets" className="text-sm font-bold underline" style={{ color: ROXO }}>Ver meus pedidos</Link></div>
      </div>
    );
  }

  if (!pets.length) {
    return (
      <div className="rounded-2xl p-4 space-y-2 text-center" style={caixa}>
        <h2 className="font-bold text-sm" style={{ color: GRAFITE }}>📅 Pedir horário</h2>
        <p className="text-sm text-slate-600">Cadastre a ficha do seu pet uma vez e peça horário em poucos toques.</p>
        <Link to="/meu/pets?novo=1" className="inline-block text-sm font-bold px-4 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>🐾 Cadastrar meu pet</Link>
      </div>
    );
  }

  async function enviar() {
    if (!f.pet_id) return toast.error('Escolha o pet');
    if (!f.servico) return toast.error('Escolha o serviço');
    if (!f.data) return toast.error('Escolha o dia');
    if (!f.periodo) return toast.error('Escolha o período');
    setEnviando(true);
    try {
      const r = await apiPainel.post('/public/meus-pets/agendamentos', {
        pet_id: Number(f.pet_id), parceiro_slug: slug, servico: f.servico, data: f.data, periodo: f.periodo,
        observacao: f.observacao, compartilhar_ficha: !jaAutorizado && f.compartilhar,
      });
      setEnviado(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não deu pra enviar o pedido');
    } finally { setEnviando(false); }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={caixa}>
      <h2 className="font-bold text-sm" style={{ color: GRAFITE }}>📅 Pedir horário</h2>
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Pra qual pet?</p>
        <div className="flex flex-wrap gap-2">
          {pets.map(p => {
            const foraPorte = p.porte && portesAtende.length && !portesAtende.includes(p.porte);
            const ativo = Number(f.pet_id) === p.id;
            return (
              <button key={p.id} type="button" disabled={foraPorte} onClick={() => set('pet_id', p.id)}
                title={foraPorte ? 'Esse pet shop não atende esse porte' : undefined}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border-2 disabled:opacity-40"
                style={ativo ? { borderColor: ROXO, color: ROXO, backgroundColor: '#fff' } : { borderColor: '#E2E8F0', color: '#475569', backgroundColor: '#fff' }}>
                {emojiEspecie(p.especie)} {p.nome}
              </button>
            );
          })}
          <Link to="/meu/pets?novo=1" className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500">+ outro pet</Link>
        </div>
      </div>
      <select className={sel} value={f.servico} onChange={e => set('servico', e.target.value)} aria-label="Serviço">
        <option value="">Serviço…</option>
        {opcoesServico.map(s => <option key={s.codigo} value={s.codigo}>{s.emoji} {s.nome}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className={sel} min={hojeSP()} max={hojeSP(catalogo.dias_max_antecedencia || 90)} value={f.data} onChange={e => set('data', e.target.value)} aria-label="Dia" />
        <div className="grid grid-cols-3 gap-1">
          {PERIODOS.map(p => (
            <button key={p.codigo} type="button" onClick={() => set('periodo', p.codigo)} className="rounded-xl border-2 text-[11px] font-bold py-1"
              style={f.periodo === p.codigo ? { borderColor: ROXO, color: ROXO, backgroundColor: '#fff' } : { borderColor: '#E2E8F0', color: '#64748B', backgroundColor: '#fff' }}>
              {p.nome}
            </button>
          ))}
        </div>
      </div>
      <textarea className={`${sel} resize-none`} rows={2} maxLength={500} value={f.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Recado pro pet shop (opcional)" />
      {preco && <p className="text-xs text-slate-600">Preço informado pelo pet shop: <span className="font-bold" style={{ color: ROXO_ESCURO }}>{brl(preco.preco)}</span></p>}
      {pet && !jaAutorizado && (
        <label className="flex items-start gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={f.compartilhar} onChange={e => set('compartilhar', e.target.checked)} />
          <span className="text-xs text-slate-600">
            <strong>Compartilhar a ficha do {pet.nome} com {servico.nome}?</strong> Eles passam a ver saúde, vacinas e contato de emergência. Você pode retirar o acesso quando quiser em Meus Pets.
          </span>
        </label>
      )}
      {pet && jaAutorizado && <p className="text-[11px] text-slate-500">🔓 {servico.nome} já pode ver a ficha do {pet.nome}.</p>}
      <button type="button" onClick={enviar} disabled={enviando}
        className="flex items-center justify-center gap-2 w-full text-sm font-black px-4 py-3 rounded-xl text-white disabled:opacity-60" style={{ backgroundColor: ROXO }}>
        {enviando ? 'Enviando…' : 'Pedir horário'}
      </button>
      <p className="text-[11px] text-center text-slate-500">O pet shop confirma ou propõe outro horário — você recebe a resposta pelo WhatsApp.</p>
    </div>
  );
}

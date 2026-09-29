import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Lock, MessageCircle, Syringe, HeartPulse, Phone } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { usePetCatalogo } from '../../components/PetServicosPicker';
import ImageCropUpload from '../../components/ImageCropUpload';
import { linkWhatsappComTexto } from '../../utils/carteirinhaWhatsapp';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import { STATUS_PEDIDO, PERIODOS, nomePeriodo, dataCurta, dataBR, hojeSP, idadePet, formatarTelefone } from '../../utils/pet';

const ABAS = [
  { id: 'abertos', label: 'Para responder' },
  { id: 'confirmados', label: 'Confirmados' },
  { id: 'atendidos', label: 'Atendidos' },
  { id: 'encerrados', label: 'Encerrados' },
];

// Pet parte 3 — pedidos de horário que chegam pro pet shop. Sem grade de
// horários: o cliente pede dia + período; aqui o pet shop confirma, propõe
// outro ou recusa, e o cliente é avisado pelo WhatsApp automaticamente.
// Ficha completa (saúde, vacinas, emergência) só aparece se o dono autorizou.
export default function AgendamentosPet() {
  const [aba, setAba] = useState('abertos');
  const [dados, setDados] = useState(null);

  function carregar(filtro = aba) {
    setDados(null);
    apiParceiro.get('/parceiro/pet-agenda', { params: { filtro } })
      .then(r => setDados(r.data))
      .catch(() => { toast.error('Erro ao carregar os pedidos'); setDados({ agendamentos: [], pendentes: 0 }); });
  }
  useEffect(() => { carregar(aba); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [aba]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>🐾 Agendamentos</h1>
        <p className="text-sm text-slate-500 mt-1">Pedidos de horário dos clientes. Confirme, proponha outro horário ou recuse — o cliente recebe a resposta no WhatsApp.</p>
      </div>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {ABAS.map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)} className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg ${aba === a.id ? 'bg-white shadow' : 'text-slate-500'}`} style={aba === a.id ? { color: ROXO } : undefined}>
            {a.label}{a.id === 'abertos' && dados?.pendentes > 0 ? ` (${dados.pendentes})` : ''}
          </button>
        ))}
      </div>
      {!dados ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>
      ) : dados.agendamentos.length === 0 ? (
        <p className="text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-100 py-10">
          {aba === 'abertos' ? 'Nenhum pedido esperando resposta. Quando um cliente pedir horário, aparece aqui e você recebe um aviso no WhatsApp.' : 'Nada por aqui ainda.'}
        </p>
      ) : (
        <div className="space-y-3">
          {dados.agendamentos.map(ag => <CardPedido key={ag.id} ag={ag} filtro={aba} onAtualizado={setDados} />)}
        </div>
      )}
    </div>
  );
}

function CardPedido({ ag, filtro, onAtualizado }) {
  const catalogo = usePetCatalogo();
  const servico = catalogo?.servicos.find(s => s.codigo === ag.servico);
  const st = STATUS_PEDIDO[ag.status] || STATUS_PEDIDO.pendente;
  const [modo, setModo] = useState(null); // null | 'propor' | 'recusar'
  const [proposta, setProposta] = useState({ data: '', periodo: '', resposta: '' });
  const [enviando, setEnviando] = useState(false);
  const [avisoManual, setAvisoManual] = useState(null); // texto quando o WhatsApp automático falhou
  const aberto = ['pendente', 'proposta'].includes(ag.status);
  const podeDesmarcar = ag.status === 'confirmado' && String(ag.data) >= hojeSP();

  async function responder(acao, extra = {}) {
    setEnviando(true);
    try {
      const r = await apiParceiro.post(`/parceiro/pet-agenda/${ag.id}/responder`, { acao, ...extra }, { params: { filtro } });
      toast.success({ confirmar: 'Horário confirmado!', propor: 'Proposta enviada!', recusar: 'Pedido recusado' }[acao]);
      if (!r.data.whatsapp_avisado && ag.cliente_whatsapp) {
        setAvisoManual(acao);
        toast('Não conseguimos avisar o cliente pelo WhatsApp — use o botão verde do pedido.', { icon: '⚠️', duration: 7000 });
      }
      onAtualizado(r.data);
      setModo(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao responder');
    } finally { setEnviando(false); }
  }

  const linkCliente = ag.cliente_whatsapp
    ? linkWhatsappComTexto(ag.cliente_whatsapp, `Olá, ${ag.cliente_nome}! Aqui é do pet shop, sobre o pedido de ${servico?.nome || 'horário'} pro ${ag.pet_nome} pelo IUB MAIS+ 🐾`)
    : null;

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 ${enviando ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold" style={{ color: PRETO }}>{servico?.emoji} {servico?.nome || ag.servico} · {ag.pet_nome}</p>
          <p className="text-xs text-slate-500 mt-0.5">{ag.pet_resumo}</p>
          <p className="text-sm font-semibold mt-2" style={{ color: ROXO }}>📅 {dataCurta(ag.data)} · {nomePeriodo(ag.periodo)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Cliente: {ag.cliente_nome}
            {ag.preco_estimado != null && ` · Preço da sua tabela: ${Number(ag.preco_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ color: st.cor, backgroundColor: st.fundo }}>{st.emoji} {ag.status === 'proposta' ? 'Proposta enviada' : st.label}</span>
      </div>

      {ag.observacao && <p className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2">📝 “{ag.observacao}”</p>}
      {ag.status === 'proposta' && (
        <p className="mt-3 text-xs text-blue-800 bg-blue-50 rounded-xl px-3 py-2">Você propôs {dataCurta(ag.proposta_data)}, {nomePeriodo(ag.proposta_periodo).toLowerCase()} — esperando o cliente aceitar.</p>
      )}

      <FichaPet ag={ag} />

      {filtro === 'atendidos' && ag.atendimento_feito && <PosAtendimentoLoja ag={ag} onAtualizado={onAtualizado} />}

      {aberto && !modo && (
        <div className="flex flex-wrap gap-2 mt-4">
          {ag.status === 'pendente' && (
            <button type="button" onClick={() => responder('confirmar')} className="flex-1 min-w-[120px] text-sm font-bold py-2.5 rounded-xl text-white bg-green-600">✅ Confirmar</button>
          )}
          <button type="button" onClick={() => setModo('propor')} className="flex-1 min-w-[120px] text-sm font-bold py-2.5 rounded-xl border-2" style={{ borderColor: ROXO, color: ROXO }}>🔄 {ag.status === 'proposta' ? 'Mudar proposta' : 'Propor outro'}</button>
          <button type="button" onClick={() => setModo('recusar')} className="text-sm font-semibold py-2.5 px-4 rounded-xl border border-slate-200 text-slate-500">Recusar</button>
        </div>
      )}
      {podeDesmarcar && !modo && filtro !== 'atendidos' && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={() => setModo('propor')} className="text-xs font-semibold py-2 px-3 rounded-lg border border-slate-200 text-slate-600">Remarcar</button>
          <button type="button" onClick={() => setModo('recusar')} className="text-xs font-semibold py-2 px-3 rounded-lg border border-red-100 text-red-500">Desmarcar</button>
        </div>
      )}

      {modo === 'propor' && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-sm font-semibold" style={{ color: PRETO }}>Qual dia e período dá?</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" min={hojeSP()} max={hojeSP(catalogo?.dias_max_antecedencia || 90)} value={proposta.data} onChange={e => setProposta(p => ({ ...p, data: e.target.value }))} />
            <div className="grid grid-cols-3 gap-1">
              {PERIODOS.map(p => (
                <button key={p.codigo} type="button" onClick={() => setProposta(x => ({ ...x, periodo: p.codigo }))} className="rounded-lg border-2 text-[11px] font-bold"
                  style={proposta.periodo === p.codigo ? { borderColor: ROXO, color: ROXO } : { borderColor: '#E2E8F0', color: '#64748B' }}>{p.nome}</button>
              ))}
            </div>
          </div>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" maxLength={500} value={proposta.resposta} onChange={e => setProposta(p => ({ ...p, resposta: e.target.value }))} placeholder="Recado (opcional): ex. de manhã estamos lotados" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setModo(null)} className="flex-1 text-sm font-semibold py-2 rounded-xl border border-slate-200 text-slate-500">Voltar</button>
            <button type="button" disabled={!proposta.data || !proposta.periodo} onClick={() => responder('propor', proposta)} className="flex-[2] text-sm font-bold py-2 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>Enviar proposta</button>
          </div>
        </div>
      )}
      {modo === 'recusar' && (
        <RecusarForm ag={ag} onVoltar={() => setModo(null)} onConfirmar={resposta => responder('recusar', { resposta })} />
      )}

      {linkCliente && (aberto || ag.status === 'confirmado' || avisoManual) && (
        <a href={linkCliente} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold mt-3 px-3 py-1.5 rounded-lg border ${avisoManual ? 'border-green-500 bg-green-50 text-green-800' : 'border-green-200 text-green-700'}`}>
          <MessageCircle className="w-3.5 h-3.5" /> {avisoManual ? 'Avisar o cliente pelo WhatsApp' : `Falar com ${ag.cliente_nome}`}
        </a>
      )}
      {ag.resposta && !aberto && <p className="text-xs text-slate-500 mt-2">Seu recado: “{ag.resposta}”</p>}
    </div>
  );
}

// Parte 4: depois do atendimento — fotos antes/depois (até 3 de cada; a 1ª
// avisa o dono no WhatsApp) e a avaliação do cliente com resposta pública.
function PosAtendimentoLoja({ ag, onAtualizado }) {
  const [enviando, setEnviando] = useState(null); // 'antes' | 'depois'
  const [resposta, setResposta] = useState(ag.avaliacao?.resposta || '');
  const [editandoResposta, setEditandoResposta] = useState(false);
  const fotos = ag.fotos || [];

  async function subir(tipo, file) {
    setEnviando(tipo);
    try {
      const fd = new FormData();
      fd.append('tipo', tipo);
      fd.append('fotos', file);
      const r = await apiParceiro.post(`/parceiro/pet-agenda/${ag.id}/fotos`, fd);
      onAtualizado(r.data);
      if (r.data.whatsapp_avisado === true) toast.success(`Foto enviada — avisamos ${ag.cliente_nome} pelo WhatsApp 📸`);
      else toast.success('Foto enviada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar a foto');
    } finally { setEnviando(null); }
  }
  async function remover(foto) {
    if (!window.confirm('Tirar esta foto?')) return;
    try { onAtualizado((await apiParceiro.delete(`/parceiro/pet-agenda/${ag.id}/fotos/${foto.id}`)).data); } catch { toast.error('Erro ao remover'); }
  }
  async function responderAvaliacao() {
    try {
      onAtualizado((await apiParceiro.post(`/parceiro/pet-agenda/${ag.id}/avaliacao/resposta`, { resposta })).data);
      setEditandoResposta(false);
      toast.success('Resposta publicada');
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao responder'); }
  }

  // Parte 5: sem QR, o pet shop marca aqui (conta como ele ter lido o QR do pet)
  async function marcarRealizado() {
    try {
      const r = await apiParceiro.post('/parceiro/pet-fidelidade/atendimentos', { agendamento_id: ag.id });
      const f = r.data.fidelidade;
      toast.success(f?.premio ? `Registrado! 🎁 Cartão completo: ${f.premio.premio_texto}` : f ? `Registrado! Cartão ${f.carimbos}/${f.meta}` : 'Atendimento registrado');
      onAtualizado((await apiParceiro.get('/parceiro/pet-agenda', { params: { filtro: 'atendidos' } })).data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao registrar'); }
  }

  return (
    <div className="mt-4 space-y-3">
      {ag.atendimento_registrado ? (
        <p className="text-xs font-semibold text-green-700">✅ Atendimento registrado (conta no cartão fidelidade)</p>
      ) : ag.pet_id ? (
        <button type="button" onClick={marcarRealizado} className="w-full text-sm font-bold py-2.5 rounded-xl text-white bg-green-600">✅ Marcar como realizado</button>
      ) : null}
      <div className="rounded-xl border border-slate-100 p-3">
        <p className="text-sm font-bold" style={{ color: PRETO }}>📸 Fotos antes e depois</p>
        <p className="text-[11px] text-slate-500 mb-2">O dono sempre vê. Na sua página pública só aparecem se ele permitir {ag.fotos_publicas ? '— ✅ ele permitiu' : ''}.</p>
        <div className="grid grid-cols-2 gap-3">
          {['antes', 'depois'].map(tipo => {
            const lista = fotos.filter(f => f.tipo === tipo);
            return (
              <div key={tipo}>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{tipo}</p>
                <div className="grid grid-cols-3 gap-1">
                  {lista.map(f => (
                    <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img src={f.url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => remover(f)} aria-label="Tirar foto" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 text-red-600 text-xs font-bold leading-none">×</button>
                    </div>
                  ))}
                </div>
                {lista.length < 3 && (
                  <ImageCropUpload aspectRatio={1} botaoUnico disabled={Boolean(enviando)} label={enviando === tipo ? 'Enviando…' : `+ Foto de ${tipo}`}
                    onCropComplete={file => subir(tipo, file)}
                    botaoClassName="mt-1 w-full text-xs font-semibold py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 flex items-center justify-center gap-1 disabled:opacity-50" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {ag.avaliacao ? (
        <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
          <p className="text-sm">{'⭐'.repeat(ag.avaliacao.nota)}<span className="text-slate-300">{'★'.repeat(5 - ag.avaliacao.nota)}</span> <span className="text-xs text-slate-500">— {ag.cliente_nome}</span></p>
          {ag.avaliacao.comentario && <p className="text-sm text-slate-700 mt-1">“{ag.avaliacao.comentario}”</p>}
          {ag.avaliacao.oculta && <p className="text-[11px] text-slate-400 mt-1">Comentário ocultado pela moderação (a nota continua valendo).</p>}
          {ag.avaliacao.resposta && !editandoResposta ? (
            <div className="mt-2 pl-2 border-l-2 border-amber-300">
              <p className="text-xs text-slate-700"><strong>Sua resposta:</strong> {ag.avaliacao.resposta}</p>
              <button type="button" onClick={() => setEditandoResposta(true)} className="text-[11px] font-semibold underline text-slate-500 mt-1">Editar resposta</button>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none bg-white" rows={2} maxLength={600} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Responder (fica público na sua página)" />
              <button type="button" onClick={responderAvaliacao} disabled={!resposta.trim()} className="text-xs font-bold px-3 py-2 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>Publicar resposta</button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">⭐ {ag.cliente_nome} ainda não avaliou. {fotos.length ? '' : 'Mandar as fotos costuma trazer a avaliação — o cliente recebe o aviso no WhatsApp.'}</p>
      )}
    </div>
  );
}

function RecusarForm({ ag, onVoltar, onConfirmar }) {
  const [resposta, setResposta] = useState('');
  return (
    <div className="mt-4 rounded-xl border border-red-100 bg-red-50/40 p-3 space-y-2">
      <p className="text-sm font-semibold text-red-800">{ag.status === 'confirmado' ? 'Desmarcar este horário?' : 'Recusar este pedido?'}</p>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" maxLength={500} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Motivo pro cliente (opcional)" />
      <div className="flex gap-2">
        <button type="button" onClick={onVoltar} className="flex-1 text-sm font-semibold py-2 rounded-xl border border-slate-200 text-slate-500 bg-white">Voltar</button>
        <button type="button" onClick={() => onConfirmar(resposta)} className="flex-[2] text-sm font-bold py-2 rounded-xl text-white bg-red-600">{ag.status === 'confirmado' ? 'Desmarcar' : 'Recusar'}</button>
      </div>
    </div>
  );
}

// Ficha do pet: só com autorização do dono (o backend já manda null se não)
function FichaPet({ ag }) {
  const f = ag.ficha;
  if (!f) {
    return (
      <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" /> Ficha completa não compartilhada pelo dono{ag.pet_id ? '' : ' (pet removido)'}.
      </p>
    );
  }
  const alerta = [f.alergias && `Alergia: ${f.alergias}`, f.medicamentos && `Medicamentos: ${f.medicamentos}`, f.comportamento && `Comportamento: ${f.comportamento}`].filter(Boolean);
  const idade = idadePet(f.nascimento, f.nascimento_aproximado);
  return (
    <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5" open={alerta.length > 0}>
      <summary className="text-xs font-bold cursor-pointer" style={{ color: ROXO }}>🔓 Ficha do {ag.pet_nome} (compartilhada pelo dono)</summary>
      <div className="mt-2 space-y-2 text-xs text-slate-700">
        <div className="flex gap-3">
          {f.foto_url && <img src={f.foto_url} alt="" className="w-14 h-14 rounded-xl object-cover" />}
          <div className="space-y-0.5">
            {idade && <p>Idade: {idade}</p>}
            <p>Castrado: {f.castrado === true ? 'sim' : f.castrado === false ? 'não' : 'não informado'}</p>
          </div>
        </div>
        {alerta.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-amber-900 space-y-0.5">
            <p className="font-bold flex items-center gap-1"><HeartPulse className="w-3.5 h-3.5" /> Atenção</p>
            {alerta.map(a => <p key={a}>{a}</p>)}
          </div>
        )}
        {f.vacinas.length > 0 && (
          <div>
            <p className="font-bold flex items-center gap-1"><Syringe className="w-3.5 h-3.5" /> Vacinas</p>
            <ul className="mt-0.5 space-y-0.5">
              {f.vacinas.map((v, i) => <li key={i}>{v.nome}{v.data ? ` · ${dataBR(v.data)}` : ''}{v.proxima_dose ? ` · próxima ${dataBR(v.proxima_dose)}` : ''}</li>)}
            </ul>
          </div>
        )}
        {(f.vet_nome || f.vet_telefone || f.contato_extra_nome || f.contato_extra_telefone) && (
          <div>
            <p className="font-bold flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Emergência</p>
            {(f.vet_nome || f.vet_telefone) && <p>Veterinário: {[f.vet_nome, formatarTelefone(f.vet_telefone)].filter(Boolean).join(' · ')}</p>}
            {(f.contato_extra_nome || f.contato_extra_telefone) && <p>Contato: {[f.contato_extra_nome, formatarTelefone(f.contato_extra_telefone)].filter(Boolean).join(' · ')}</p>}
          </div>
        )}
      </div>
    </details>
  );
}

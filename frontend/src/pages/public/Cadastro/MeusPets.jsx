import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Plus, Pencil, Trash2, X, Save, ShieldCheck, Syringe, HeartPulse, Phone, MessageCircle } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';
import { usePetCatalogo } from '../../../components/PetServicosPicker';
import ImageCropUpload from '../../../components/ImageCropUpload';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { STATUS_PEDIDO, nomePeriodo, dataCurta, hojeSP, idadePet, emojiEspecie, formatarTelefone } from '../../../utils/pet';

const NAVY = '#0B1F3A';
const LIME = '#B8E62C';

// Pet parte 3 — /meu/pets. A ficha é do DONO (LGPD): ele decide quais pet
// shops podem ver (autoriza ao pedir horário, revoga aqui). Também é onde
// ele acompanha os pedidos de horário e aceita/cancela propostas.
export default function MeusPets() {
  const catalogo = usePetCatalogo();
  const [params] = useSearchParams();
  const [pets, setPets] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [editando, setEditando] = useState(params.get('novo') === '1' ? 'novo' : null); // null | 'novo' | pet
  const [ocupado, setOcupado] = useState(null);

  async function carregar() {
    try {
      const [p, a] = await Promise.all([apiPainel.get('/public/meus-pets'), apiPainel.get('/public/meus-pets/agendamentos')]);
      setPets(p.data.pets);
      setPedidos(a.data.agendamentos);
    } catch {
      toast.error('Erro ao carregar seus pets');
      setPets([]);
    }
  }
  useEffect(() => { carregar(); }, []);

  async function excluir(pet) {
    if (!window.confirm(`Excluir ${pet.nome}? A ficha deixa de aparecer pros pet shops. Os pedidos antigos continuam no histórico.`)) return;
    try {
      const r = await apiPainel.delete(`/public/meus-pets/${pet.id}`);
      setPets(r.data.pets);
      toast.success(`${pet.nome} foi removido`);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao excluir'); }
  }

  async function revogar(pet, aut) {
    if (!window.confirm(`${aut.nome} não vai mais ver a ficha do ${pet.nome}. Confirma?`)) return;
    try {
      const r = await apiPainel.delete(`/public/meus-pets/${pet.id}/autorizacoes/${aut.parceiro_id}`);
      setPets(r.data.pets);
      toast.success('Acesso retirado');
    } catch { toast.error('Erro ao retirar o acesso'); }
  }

  async function acaoPedido(ped, acao) {
    if (acao === 'cancelar' && !window.confirm(`Cancelar o pedido de ${ped.pet_nome} em ${ped.parceiro_nome}?`)) return;
    setOcupado(ped.id);
    try {
      const r = await apiPainel.post(`/public/meus-pets/agendamentos/${ped.id}/${acao}`);
      setPedidos(ps => ps.map(p => (p.id === ped.id ? r.data.agendamento : p)));
      toast.success(acao === 'aceitar' ? 'Horário confirmado! 🎉' : 'Pedido cancelado');
      if (!r.data.whatsapp_avisado) toast('Não conseguimos avisar o pet shop pelo WhatsApp — use o botão do pedido.', { icon: '⚠️', duration: 6000 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    } finally { setOcupado(null); }
  }

  if (pets === null) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (editando) {
    return (
      <FormPet
        pet={editando === 'novo' ? null : editando}
        catalogo={catalogo}
        onCancelar={() => setEditando(null)}
        onSalvo={novos => { setPets(novos); setEditando(null); }}
      />
    );
  }

  const abertos = pedidos.filter(p => ['pendente', 'proposta', 'confirmado'].includes(p.status) && String(p.data) >= hojeSP());
  const antigos = pedidos.filter(p => !abertos.includes(p));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: NAVY }}>🐾 Meus Pets</h1>
          <p className="text-slate-400 text-xs mt-1">A ficha é sua: só vê quem você autorizar.</p>
        </div>
        <button type="button" onClick={() => setEditando('novo')} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl text-white" style={{ backgroundColor: NAVY }}>
          <Plus className="w-4 h-4" /> Adicionar pet
        </button>
      </div>

      {abertos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold" style={{ color: NAVY }}>📅 Pedidos de horário</h2>
          {abertos.map(p => <CardPedido key={p.id} ped={p} ocupado={ocupado === p.id} onAcao={acaoPedido} />)}
        </section>
      )}

      {pets.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-slate-100 py-10 px-6">
          <p className="text-4xl">🐶🐱</p>
          <p className="text-sm font-semibold text-slate-700 mt-2">Cadastre seu pet</p>
          <p className="text-xs text-slate-400 mt-1">Com a ficha pronta, você pede horário em qualquer pet shop do IUB MAIS+ em poucos toques.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pets.map(pet => <CardPet key={pet.id} pet={pet} catalogo={catalogo} onEditar={() => setEditando(pet)} onExcluir={() => excluir(pet)} onRevogar={aut => revogar(pet, aut)} />)}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Pra pedir horário, escolha um pet shop em <Link to="/marketplace/pet" className="underline font-semibold">🐾 Pet Shops</Link>.
      </p>

      {antigos.length > 0 && (
        <details className="bg-white rounded-2xl border border-slate-100 p-4">
          <summary className="text-sm font-semibold cursor-pointer" style={{ color: NAVY }}>Histórico de pedidos ({antigos.length})</summary>
          <div className="space-y-2 mt-3">{antigos.map(p => <CardPedido key={p.id} ped={p} onAcao={acaoPedido} />)}</div>
        </details>
      )}
    </div>
  );
}

function CardPedido({ ped, ocupado, onAcao }) {
  const st = STATUS_PEDIDO[ped.status] || STATUS_PEDIDO.pendente;
  const catalogo = usePetCatalogo();
  const servico = catalogo?.servicos.find(s => s.codigo === ped.servico);
  const aberto = ['pendente', 'proposta', 'confirmado'].includes(ped.status);
  const linkLoja = ped.parceiro_whatsapp
    ? linkWhatsappComTexto(ped.parceiro_whatsapp, `Olá! Sobre meu pedido de ${servico?.nome || 'horário'} pro ${ped.pet_nome} (${dataCurta(ped.data)}, ${nomePeriodo(ped.periodo).toLowerCase()}) feito pelo IUB MAIS+ 🐾`)
    : null;
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-4 ${ocupado ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-900">{servico?.emoji} {servico?.nome || ped.servico} · {ped.pet_nome}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            <Link to={`/servicos/${ped.parceiro_slug}`} className="underline">{ped.parceiro_nome}</Link> · {dataCurta(ped.data)}, {nomePeriodo(ped.periodo).toLowerCase()}
            {ped.preco_estimado != null && ` · ${Number(ped.preco_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ color: st.cor, backgroundColor: st.fundo }}>{st.emoji} {st.label}</span>
      </div>
      {ped.status === 'proposta' && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-blue-900">Proposta: {dataCurta(ped.proposta_data)}, {nomePeriodo(ped.proposta_periodo).toLowerCase()}</p>
          {ped.resposta && <p className="text-xs text-blue-800 mt-0.5">“{ped.resposta}”</p>}
          <div className="flex gap-2 mt-2.5">
            <button type="button" onClick={() => onAcao(ped, 'aceitar')} className="flex-1 text-xs font-bold py-2 rounded-lg text-white bg-green-600">Aceitar</button>
            <button type="button" onClick={() => onAcao(ped, 'cancelar')} className="flex-1 text-xs font-bold py-2 rounded-lg border border-slate-300 text-slate-600 bg-white">Cancelar pedido</button>
          </div>
        </div>
      )}
      {ped.status !== 'proposta' && ped.resposta && <p className="text-xs text-slate-500 mt-2">“{ped.resposta}”</p>}
      {aberto && (
        <div className="flex flex-wrap gap-2 mt-3">
          {linkLoja && (
            <a href={linkLoja} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-200 text-green-700">
              <MessageCircle className="w-3.5 h-3.5" /> Falar com a loja
            </a>
          )}
          {ped.status !== 'proposta' && (
            <button type="button" onClick={() => onAcao(ped, 'cancelar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500">Cancelar pedido</button>
          )}
        </div>
      )}
    </div>
  );
}

function CardPet({ pet, catalogo, onEditar, onExcluir, onRevogar }) {
  const raca = pet.raca === 'srd' ? 'Sem raça definida' : (catalogo?.racas.find(r => r.codigo === pet.raca)?.nome || pet.raca_outra);
  const porte = catalogo?.portes.find(p => p.codigo === pet.porte)?.nome;
  const idade = idadePet(pet.nascimento, pet.nascimento_aproximado);
  const resumo = [raca, porte && `porte ${porte.toLowerCase()}`, pet.sexo === 'macho' ? 'macho' : pet.sexo === 'femea' ? 'fêmea' : null, idade].filter(Boolean).join(' · ');
  const alertas = [pet.alergias && `Alergia: ${pet.alergias}`, pet.medicamentos && `Remédio: ${pet.medicamentos}`, pet.comportamento].filter(Boolean);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0 text-3xl">
          {pet.foto_url ? <img src={pet.foto_url} alt="" className="w-full h-full object-cover" /> : emojiEspecie(pet.especie)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">{pet.nome}</p>
          <p className="text-slate-400 text-xs mt-0.5">{resumo || 'Complete a ficha'}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pet.castrado === true && <Chip>Castrado</Chip>}
            {pet.vacinas.length > 0 && <Chip><Syringe className="w-3 h-3" /> {pet.vacinas.length} vacina{pet.vacinas.length > 1 ? 's' : ''}</Chip>}
            {pet.vet_nome && <Chip><Phone className="w-3 h-3" /> Vet: {pet.vet_nome}</Chip>}
          </div>
        </div>
      </div>
      {alertas.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-900 space-y-0.5">
          {alertas.map(a => <p key={a}>⚠️ {a}</p>)}
        </div>
      )}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Quem pode ver a ficha completa</p>
        {pet.autorizados.length === 0 ? (
          <p className="text-xs text-slate-400 mt-1">Nenhum pet shop. Você decide ao pedir horário.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {pet.autorizados.map(a => (
              <li key={a.parceiro_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-700 truncate">{a.nome}</span>
                <button type="button" onClick={() => onRevogar(a)} className="text-red-600 font-semibold hover:underline flex-shrink-0">Retirar acesso</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onEditar} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600"><Pencil className="w-3.5 h-3.5" /> Editar ficha</button>
        <button type="button" onClick={onExcluir} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-100 text-red-500 ml-auto"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
      </div>
    </div>
  );
}

function Chip({ children }) {
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{children}</span>;
}

const VAZIO = {
  nome: '', especie: 'cao', raca: '', raca_outra: '', porte: '', sexo: '', nascimento: '', nascimento_aproximado: false,
  castrado: null, alergias: '', medicamentos: '', comportamento: '',
  vet_nome: '', vet_telefone: '', contato_extra_nome: '', contato_extra_telefone: '', vacinas: [],
};

function FormPet({ pet, catalogo, onCancelar, onSalvo }) {
  const [f, setF] = useState(() => (pet ? {
    ...VAZIO, ...Object.fromEntries(Object.keys(VAZIO).map(k => [k, pet[k] ?? VAZIO[k]])),
    vet_telefone: formatarTelefone(pet.vet_telefone), contato_extra_telefone: formatarTelefone(pet.contato_extra_telefone),
    vacinas: pet.vacinas.map(v => ({ nome: v.nome, data: v.data || '', proxima_dose: v.proxima_dose || '' })),
  } : VAZIO));
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(pet?.foto_url || null);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const racas = (catalogo?.racas || []).filter(r => r.especie === f.especie);

  function setVacina(i, k, v) { setF(x => ({ ...x, vacinas: x.vacinas.map((vac, j) => (j === i ? { ...vac, [k]: v } : vac)) })); }

  async function salvar() {
    if (!f.nome.trim()) return toast.error('Dê um nome pro seu pet');
    setSalvando(true);
    try {
      const corpo = { ...f, raca: f.raca || null, porte: f.porte || null, sexo: f.sexo || null, nascimento: f.nascimento || null };
      const r = pet ? await apiPainel.put(`/public/meus-pets/${pet.id}`, corpo) : await apiPainel.post('/public/meus-pets', corpo);
      let lista = r.data.pets;
      if (foto) {
        try {
          const fd = new FormData();
          fd.append('foto', foto);
          lista = (await apiPainel.post(`/public/meus-pets/${r.data.pet.id}/foto`, fd)).data.pets;
        } catch (err) {
          toast.error(`Ficha salva, mas a foto não subiu: ${err.response?.data?.error || 'tente de novo'}`, { duration: 6000 });
        }
      }
      toast.success(pet ? 'Ficha atualizada!' : `${f.nome} cadastrado! 🐾`);
      onSalvo(lista);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>{pet ? `Ficha do ${pet.nome}` : 'Novo pet'}</h1>
        <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar"><X className="w-5 h-5" /></button>
      </div>

      <Secao titulo="🐾 Básico">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-4xl flex-shrink-0">
            {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : emojiEspecie(f.especie)}
          </div>
          <ImageCropUpload aspectRatio={1} botaoUnico label={preview ? 'Trocar foto' : 'Adicionar foto'}
            onCropComplete={file => { setFoto(file); setPreview(URL.createObjectURL(file)); }} />
        </div>
        <Campo label="Nome *"><input className="input" value={f.nome} maxLength={60} onChange={e => set('nome', e.target.value)} /></Campo>
        <Campo label="Espécie *">
          <div className="grid grid-cols-3 gap-2">
            {(catalogo?.especies || []).map(e => (
              <button key={e.codigo} type="button" onClick={() => setF(x => ({ ...x, especie: e.codigo, raca: x.especie === e.codigo ? x.raca : '' }))}
                className="py-2 rounded-xl border-2 text-sm font-semibold" style={f.especie === e.codigo ? { borderColor: NAVY, color: NAVY, backgroundColor: '#EEF2F7' } : { borderColor: '#E2E8F0', color: '#64748B' }}>
                {e.emoji} {e.nome}
              </button>
            ))}
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Raça">
            <select className="input" value={f.raca} onChange={e => set('raca', e.target.value)}>
              <option value="">Outra / não sei</option>
              <option value="srd">Sem raça definida (vira-lata)</option>
              {racas.map(r => <option key={r.codigo} value={r.codigo}>{r.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Porte">
            <select className="input" value={f.porte} onChange={e => set('porte', e.target.value)}>
              <option value="">Selecione</option>
              {(catalogo?.portes || []).map(p => <option key={p.codigo} value={p.codigo}>{p.nome} ({p.faixa})</option>)}
            </select>
          </Campo>
        </div>
        {!f.raca && <Campo label="Qual raça? (opcional)"><input className="input" value={f.raca_outra} maxLength={60} onChange={e => set('raca_outra', e.target.value)} placeholder="Ex.: Akita" /></Campo>}
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Sexo">
            <select className="input" value={f.sexo} onChange={e => set('sexo', e.target.value)}>
              <option value="">Selecione</option><option value="macho">Macho</option><option value="femea">Fêmea</option>
            </select>
          </Campo>
          <Campo label="Nascimento">
            <input type="date" className="input" max={hojeSP()} value={f.nascimento} onChange={e => set('nascimento', e.target.value)} />
          </Campo>
        </div>
        {f.nascimento && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={f.nascimento_aproximado} onChange={e => set('nascimento_aproximado', e.target.checked)} /> A data é aproximada
          </label>
        )}
      </Secao>

      <Secao titulo={<><HeartPulse className="w-4 h-4 inline -mt-0.5" /> Saúde</>}>
        <Campo label="Castrado?">
          <div className="grid grid-cols-3 gap-2">
            {[[true, 'Sim'], [false, 'Não'], [null, 'Não sei']].map(([v, l]) => (
              <button key={l} type="button" onClick={() => set('castrado', v)} className="py-2 rounded-xl border-2 text-sm font-semibold"
                style={f.castrado === v ? { borderColor: NAVY, color: NAVY, backgroundColor: '#EEF2F7' } : { borderColor: '#E2E8F0', color: '#64748B' }}>{l}</button>
            ))}
          </div>
        </Campo>
        <Campo label="Alergias"><input className="input" value={f.alergias} maxLength={500} onChange={e => set('alergias', e.target.value)} placeholder="Ex.: frango, shampoo com perfume" /></Campo>
        <Campo label="Medicamentos em uso"><input className="input" value={f.medicamentos} maxLength={500} onChange={e => set('medicamentos', e.target.value)} placeholder="Nome e horário, se tiver" /></Campo>
        <Campo label="Comportamento"><textarea className="input resize-none" rows={2} value={f.comportamento} maxLength={500} onChange={e => set('comportamento', e.target.value)} placeholder="Ex.: morde quando mexem na pata, tem medo de secador" /></Campo>
      </Secao>

      <Secao titulo={<><Syringe className="w-4 h-4 inline -mt-0.5" /> Vacinas</>}>
        {f.vacinas.length === 0 && <p className="text-xs text-slate-400">Nenhuma vacina registrada.</p>}
        {f.vacinas.map((v, i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
            <div className="flex gap-2">
              <input className="input flex-1" value={v.nome} maxLength={80} onChange={e => setVacina(i, 'nome', e.target.value)} placeholder="Vacina (ex.: V10, Antirrábica)" />
              <button type="button" onClick={() => setF(x => ({ ...x, vacinas: x.vacinas.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-500 px-1" aria-label="Tirar vacina"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-500">Aplicada em<input type="date" className="input mt-0.5" max={hojeSP()} value={v.data} onChange={e => setVacina(i, 'data', e.target.value)} /></label>
              <label className="text-[11px] text-slate-500">Próxima dose<input type="date" className="input mt-0.5" value={v.proxima_dose} onChange={e => setVacina(i, 'proxima_dose', e.target.value)} /></label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setF(x => ({ ...x, vacinas: [...x.vacinas, { nome: '', data: '', proxima_dose: '' }] }))}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600"><Plus className="w-3.5 h-3.5" /> Adicionar vacina</button>
        <p className="text-[11px] text-slate-400">É só um registro seu — o sistema não manda lembrete da próxima dose.</p>
      </Secao>

      <Secao titulo={<><Phone className="w-4 h-4 inline -mt-0.5" /> Contato de emergência</>}>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Veterinário"><input className="input" value={f.vet_nome} maxLength={100} onChange={e => set('vet_nome', e.target.value)} placeholder="Nome ou clínica" /></Campo>
          <Campo label="Telefone do vet"><input className="input" inputMode="tel" value={f.vet_telefone} onChange={e => set('vet_telefone', e.target.value)} placeholder="(64) 99999-9999" /></Campo>
          <Campo label="Outra pessoa"><input className="input" value={f.contato_extra_nome} maxLength={100} onChange={e => set('contato_extra_nome', e.target.value)} placeholder="Nome" /></Campo>
          <Campo label="Telefone"><input className="input" inputMode="tel" value={f.contato_extra_telefone} onChange={e => set('contato_extra_telefone', e.target.value)} placeholder="(64) 99999-9999" /></Campo>
        </div>
      </Secao>

      <div className="flex gap-2 sticky bottom-3">
        <button type="button" onClick={onCancelar} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-slate-300 bg-white text-slate-600">Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando} className="flex-[2] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg" style={{ backgroundColor: LIME, color: NAVY }}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar ficha
        </button>
      </div>
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <h2 className="font-bold text-sm" style={{ color: NAVY }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

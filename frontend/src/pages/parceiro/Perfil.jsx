import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Upload, X, ArrowUp, ArrowDown, Loader2, MapPin, Clock } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../public/Marketplace/parceirosData';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);
const DIAS = [
  { chave: 'seg', label: 'Segunda' }, { chave: 'ter', label: 'Terça' }, { chave: 'qua', label: 'Quarta' },
  { chave: 'qui', label: 'Quinta' }, { chave: 'sex', label: 'Sexta' }, { chave: 'sab', label: 'Sábado' },
  { chave: 'dom', label: 'Domingo' },
];
const DIAS_POR_INDICE = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function formatarCnpj(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}
function formatarTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
}

function statusFuncionamento(horario) {
  const agora = new Date();
  const diaHoje = DIAS_POR_INDICE[agora.getDay()];
  const hoje = horario?.[diaHoje];
  const hhmm = agora.toTimeString().slice(0, 5);

  if (hoje?.aberto && hoje.abre && hoje.fecha && hhmm >= hoje.abre && hhmm <= hoje.fecha) {
    return { aberto: true, texto: `Estamos abertos agora — fecha às ${hoje.fecha}` };
  }

  for (let i = 1; i <= 7; i++) {
    const idx = (agora.getDay() + i) % 7;
    const dia = DIAS_POR_INDICE[idx];
    const info = horario?.[dia];
    if (info?.aberto && info.abre) {
      const rotulo = i === 1 ? 'amanhã' : DIAS.find(d => d.chave === dia)?.label.toLowerCase();
      return { aberto: false, texto: `Fechado até ${rotulo} ${info.abre}` };
    }
  }
  return { aberto: false, texto: 'Horário de funcionamento não configurado' };
}

export default function ParceiroPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState(null);
  const [horario, setHorario] = useState({});
  const [categoriasExtras, setCategoriasExtras] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const logoInputRef = useRef(null);
  const fotosInputRef = useRef(null);

  useEffect(() => {
    apiParceiro.get('/parceiro/perfil').then(res => {
      const p = res.data;
      setPerfil(p);
      setForm({
        nome: p.nome || '', razao_social: p.razao_social || '', cnpj: formatarCnpj(p.cnpj || ''),
        descricao: p.descricao || '', descricao_completa: p.descricao_completa || '',
        categoria_principal: p.categoria_principal || '', beneficio: p.beneficio || '',
        endereco: p.endereco || '', bairro: p.bairro || '', cidade: p.cidade || 'Itumbiara', estado: p.estado || 'GO',
        whatsapp: formatarTelefone(p.whatsapp || ''), telefone_fixo: formatarTelefone(p.telefone_fixo || ''),
        instagram: p.instagram || '', google_maps_url: p.google_maps_url || '',
      });
      setCategoriasExtras((p.categorias || []).filter(c => c !== p.categoria_principal).slice(0, 3));
      setHorario(p.horario_funcionamento || {});
    }).catch(() => toast.error('Erro ao carregar perfil'));
  }, []);

  if (!perfil || !form) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} />
      </div>
    );
  }

  function setCampo(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  function toggleCategoriaExtra(cat) {
    setCategoriasExtras(atual => {
      if (atual.includes(cat)) return atual.filter(c => c !== cat);
      if (atual.length >= 3) { toast.error('Máximo de 3 categorias extras'); return atual; }
      return [...atual, cat];
    });
  }

  function setDiaHorario(dia, campo, valor) {
    setHorario(h => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }));
  }

  function copiarParaTodos(diaOrigem) {
    const base = horario[diaOrigem];
    if (!base) return;
    setHorario(h => {
      const novo = { ...h };
      for (const d of DIAS) novo[d.chave] = { ...base };
      return novo;
    });
    toast.success('Horário copiado pros outros dias');
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await apiParceiro.put('/parceiro/perfil', {
        ...form,
        cnpj: form.cnpj.replace(/\D/g, ''),
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        telefone_fixo: form.telefone_fixo.replace(/\D/g, ''),
        categorias_extras: categoriasExtras,
        horario_funcionamento: horario,
      });
      toast.success('Perfil atualizado!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  }

  async function handleLogo(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('A logo precisa ter até 5MB');
    setEnviandoLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await apiParceiro.post('/parceiro/perfil/logo', fd);
      setPerfil(p => ({ ...p, logo_url: res.data.logo_url }));
      toast.success('Logo atualizada!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar logo');
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function handleFotos(files) {
    const lista = Array.from(files || []);
    if (!lista.length) return;
    if (lista.some(f => f.size > 5 * 1024 * 1024)) return toast.error('Cada foto precisa ter até 5MB');
    setEnviandoFotos(true);
    try {
      const fd = new FormData();
      lista.forEach(f => fd.append('fotos', f));
      const res = await apiParceiro.post('/parceiro/perfil/fotos', fd);
      setPerfil(p => ({ ...p, fotos_estabelecimento: res.data.fotos_estabelecimento }));
      toast.success('Fotos enviadas!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar fotos');
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function removerFoto(index) {
    try {
      const res = await apiParceiro.delete(`/parceiro/perfil/fotos/${index}`);
      setPerfil(p => ({ ...p, fotos_estabelecimento: res.data.fotos_estabelecimento }));
    } catch {
      toast.error('Erro ao remover foto');
    }
  }

  async function moverFoto(index, direcao) {
    const fotos = [...perfil.fotos_estabelecimento];
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= fotos.length) return;
    [fotos[index], fotos[novoIndex]] = [fotos[novoIndex], fotos[index]];
    try {
      const res = await apiParceiro.put('/parceiro/perfil/fotos/ordem', { urls: fotos.map(f => f.url) });
      setPerfil(p => ({ ...p, fotos_estabelecimento: res.data.fotos_estabelecimento }));
    } catch {
      toast.error('Erro ao reordenar fotos');
    }
  }

  const statusHoje = statusFuncionamento(horario);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Seção 1 — Informações básicas */}
      <Secao titulo="Informações básicas">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: `${perfil.cor_icone}22` }}>
            {perfil.logo_url ? <img src={perfil.logo_url} alt="Logo" className="w-full h-full object-cover" /> : perfil.icone}
          </div>
          <div>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={enviandoLogo}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {enviandoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Trocar logo
            </button>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => handleLogo(e.target.files[0])} />
            <p className="text-slate-400 text-xs mt-1.5">JPG, PNG ou WEBP, até 5MB</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nome fantasia" value={form.nome} onChange={v => setCampo('nome', v)} />
          <Campo label="Razão social (opcional)" value={form.razao_social} onChange={v => setCampo('razao_social', v)} />
          <Campo label="CNPJ (opcional)" value={form.cnpj} onChange={v => setCampo('cnpj', formatarCnpj(v))} placeholder="00.000.000/0000-00" />
          <div>
            <Label>Categoria principal</Label>
            <select value={form.categoria_principal} onChange={e => setCampo('categoria_principal', e.target.value)} className={campoCls}>
              <option value="">Selecione</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Categorias extras (até 3)</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.filter(c => c !== form.categoria_principal).map(c => (
              <button
                key={c} type="button" onClick={() => toggleCategoriaExtra(c)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={categoriasExtras.includes(c)
                  ? { backgroundColor: ROXO, color: 'white', borderColor: ROXO }
                  : { backgroundColor: 'white', color: '#64748B', borderColor: '#E2E8F0' }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Campo label={`Descrição curta (${form.descricao.length}/200 — aparece nos cards)`} value={form.descricao}
            onChange={v => setCampo('descricao', v.slice(0, 200))} />
        </div>
        <div className="mt-4">
          <Label>Descrição completa ({form.descricao_completa.length}/2000)</Label>
          <textarea value={form.descricao_completa} onChange={e => setCampo('descricao_completa', e.target.value.slice(0, 2000))}
            rows={5} className={campoCls} />
        </div>
        <div className="mt-4">
          <Campo label='Benefício associado (ex: "20% de desconto no primeiro atendimento")' value={form.beneficio}
            onChange={v => setCampo('beneficio', v)} />
        </div>
      </Secao>

      {/* Seção 2 — Localização e contato */}
      <Secao titulo="Localização e contato">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Endereço completo" value={form.endereco} onChange={v => setCampo('endereco', v)} className="sm:col-span-2" />
          <Campo label="Bairro" value={form.bairro} onChange={v => setCampo('bairro', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Cidade" value={form.cidade} onChange={v => setCampo('cidade', v)} />
            <Campo label="Estado" value={form.estado} onChange={v => setCampo('estado', v.toUpperCase().slice(0, 2))} />
          </div>
          <Campo label="WhatsApp (obrigatório)" value={form.whatsapp} onChange={v => setCampo('whatsapp', formatarTelefone(v))} placeholder="(64) 99999-9999" />
          <Campo label="Telefone fixo (opcional)" value={form.telefone_fixo} onChange={v => setCampo('telefone_fixo', formatarTelefone(v))} placeholder="(64) 3333-3333" />
          <Campo label="Instagram (opcional)" value={form.instagram} onChange={v => setCampo('instagram', v.replace(/^@/, ''))} placeholder="seu.perfil" />
          <Campo label="URL do Google Maps (opcional)" value={form.google_maps_url} onChange={v => setCampo('google_maps_url', v)} />
        </div>
        {form.google_maps_url && (
          <a href={form.google_maps_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors">
            <MapPin className="w-4 h-4" style={{ color: ROXO }} /> Ver no Google Maps
          </a>
        )}
      </Secao>

      {/* Seção 3 — Horário de funcionamento */}
      <Secao titulo="Horário de funcionamento">
        <div
          className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: statusHoje.aberto ? '#ECFDF5' : '#F8FAFC', color: statusHoje.aberto ? '#047857' : '#64748B' }}
        >
          <Clock className="w-4 h-4" /> {statusHoje.texto}
        </div>

        <div className="space-y-2">
          {DIAS.map(dia => {
            const info = horario[dia.chave] || {};
            return (
              <div key={dia.chave} className="flex flex-wrap items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <label className="flex items-center gap-2 w-32 flex-shrink-0">
                  <input type="checkbox" checked={!!info.aberto} onChange={e => setDiaHorario(dia.chave, 'aberto', e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium" style={{ color: PRETO }}>{dia.label}</span>
                </label>
                {info.aberto && (
                  <>
                    <input type="time" value={info.abre || ''} onChange={e => setDiaHorario(dia.chave, 'abre', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    <span className="text-slate-400 text-xs">até</span>
                    <input type="time" value={info.fecha || ''} onChange={e => setDiaHorario(dia.chave, 'fecha', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    <button type="button" onClick={() => copiarParaTodos(dia.chave)} className="text-xs font-medium hover:underline" style={{ color: ROXO }}>
                      Copiar pros outros dias
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Secao>

      {/* Seção 4 — Galeria de fotos */}
      <Secao titulo="Galeria de fotos do estabelecimento">
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); handleFotos(e.dataTransfer.files); }}
          onClick={() => fotosInputRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
          style={{ borderColor: arrastando ? ROXO : '#E2E8F0', backgroundColor: arrastando ? `${ROXO}08` : 'transparent' }}
        >
          {enviandoFotos ? (
            <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: ROXO }} />
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto text-slate-400" />
              <p className="text-sm font-medium text-slate-500 mt-2">Arraste fotos aqui ou clique pra escolher</p>
              <p className="text-slate-400 text-xs mt-1">Até 5 fotos no total, 5MB cada</p>
            </>
          )}
          <input ref={fotosInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
            onChange={(e) => handleFotos(e.target.files)} />
        </div>

        {perfil.fotos_estabelecimento?.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {perfil.fotos_estabelecimento.map((foto, i) => (
              <div key={foto.url} className="relative rounded-xl overflow-hidden aspect-square border border-slate-100 group">
                <img src={foto.url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removerFoto(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3.5 h-3.5 text-red-600" />
                </button>
                <div className="absolute bottom-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => moverFoto(i, -1)} disabled={i === 0} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-40">
                    <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button type="button" onClick={() => moverFoto(i, 1)} disabled={i === perfil.fotos_estabelecimento.length - 1} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-40">
                    <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button" onClick={handleSalvar} disabled={salvando}
          className="flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 disabled:opacity-60"
          style={{ backgroundColor: ROXO }}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar alterações
        </button>
      </div>
    </div>
  );
}

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

function Label({ children }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1.5">{children}</label>;
}

function Campo({ label, value, onChange, placeholder, className }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={campoCls} />
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-bold text-base mb-5" style={{ color: PRETO }}>{titulo}</h2>
      {children}
    </div>
  );
}

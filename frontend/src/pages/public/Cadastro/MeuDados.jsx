import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Save, Camera } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';
import { assetUrl } from '../../../services/api';
import { dataISOParaBR } from './InputDataBR';
import CapturaFoto from './CapturaFoto';
import AvatarPlaceholder from '../../../components/AvatarPlaceholder';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';

function maskWhatsapp(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export default function MeuDados() {
  const { dados, setDados } = useOutletContext();
  const [form, setForm] = useState({
    whatsapp: maskWhatsapp(dados.whatsapp),
    email: dados.email || '',
    cep: dados.cep || '',
    endereco: dados.endereco || '',
    numero: dados.numero || '',
    bairro: dados.bairro || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    empresa: dados.empresa_editavel || '',
    cargo: dados.cargo || '',
    receber_whatsapp: dados.receber_whatsapp !== false,
    receber_email: dados.receber_email !== false,
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  function campo(nome, valor) {
    setForm(f => ({ ...f, [nome]: valor }));
  }

  async function buscarCep() {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      setForm(f => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
      }));
    } catch {
      toast.error('Não deu pra buscar o CEP agora');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSalvar() {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return toast.error('E-mail inválido');
    }
    if (form.whatsapp.replace(/\D/g, '').length < 10) {
      return toast.error('WhatsApp precisa ter pelo menos 10 dígitos');
    }
    setSalvando(true);
    try {
      const res = await apiPainel.put('/public/painel/perfil', {
        ...form,
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        cep: form.cep.replace(/\D/g, ''),
      });
      setDados(res.data);
      toast.success('Dados atualizados com sucesso!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleFoto(captura) {
    if (!captura) return;
    setEnviandoFoto(true);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      const res = await apiPainel.post('/public/painel/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDados(d => ({ ...d, foto_url: res.data.foto_url }));
      setTrocandoFoto(false);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Meus Dados</h1>
        <p className="text-slate-400 text-xs mt-1">Nome, CPF e nascimento só o Sindicato altera — o resto é com você.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <div className="flex items-center gap-4">
          {dados.foto_url ? (
            <img src={assetUrl(dados.foto_url)} alt="" className="w-16 h-16 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: GOLD }} />
          ) : (
            <AvatarPlaceholder nome={dados.nome_completo} size={64} className="border-2" style={{ borderColor: GOLD }} />
          )}
          <button
            type="button" onClick={() => setTrocandoFoto(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" /> {trocandoFoto ? 'Cancelar' : 'Trocar foto'}
          </button>
        </div>
        {trocandoFoto && (
          <div className="space-y-2">
            <CapturaFoto onCapturar={handleFoto} />
            {enviandoFoto && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Dados fixos (só o Sindicato altera)</h2>
        <Campo label="Nome"><p className="text-sm text-slate-700 py-2">{dados.nome_completo}</p></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="CPF"><p className="text-sm text-slate-700 py-2">{dados.cpf_parcial || '—'}</p></Campo>
          <Campo label="Nascimento"><p className="text-sm text-slate-700 py-2">{dataISOParaBR(dados.data_nascimento) || '—'}</p></Campo>
        </div>
        <Campo label="Sindicato"><p className="text-sm text-slate-700 py-2">SECI — Sindicato dos Empregados no Comércio de Itumbiara</p></Campo>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Contato</h2>
        <Campo label="E-mail"><input type="email" className="input" value={form.email} onChange={e => campo('email', e.target.value)} /></Campo>
        <Campo label="WhatsApp"><input type="text" inputMode="numeric" className="input" value={form.whatsapp} onChange={e => campo('whatsapp', maskWhatsapp(e.target.value))} /></Campo>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Endereço</h2>
        <Campo label="CEP">
          <div className="flex gap-2">
            <input
              type="text" inputMode="numeric" className="input flex-1" maxLength={9}
              value={form.cep} onChange={e => campo('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
              onBlur={buscarCep}
            />
            {buscandoCep && <Loader2 className="w-4 h-4 animate-spin text-slate-400 self-center" />}
          </div>
        </Campo>
        <Campo label="Endereço"><input type="text" className="input" value={form.endereco} onChange={e => campo('endereco', e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Número"><input type="text" className="input" value={form.numero} onChange={e => campo('numero', e.target.value)} /></Campo>
          <Campo label="Bairro"><input type="text" className="input" value={form.bairro} onChange={e => campo('bairro', e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cidade"><input type="text" className="input" value={form.cidade} onChange={e => campo('cidade', e.target.value)} /></Campo>
          <Campo label="Estado"><input type="text" maxLength={2} className="input uppercase" value={form.estado} onChange={e => campo('estado', e.target.value.toUpperCase())} /></Campo>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Trabalho (opcional)</h2>
        <Campo label="Empresa"><input type="text" className="input" value={form.empresa} onChange={e => campo('empresa', e.target.value)} /></Campo>
        <Campo label="Cargo / função"><input type="text" className="input" value={form.cargo} onChange={e => campo('cargo', e.target.value)} /></Campo>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Como quer ser avisado</h2>
        <Toggle label="Receber por WhatsApp" checked={form.receber_whatsapp} onChange={v => campo('receber_whatsapp', v)} />
        <Toggle label="Receber por e-mail" checked={form.receber_email} onChange={v => campo('receber_email', v)} />
      </div>

      <button
        onClick={handleSalvar} disabled={salvando}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: LIME, color: NAVY }}
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar alterações
      </button>
    </div>
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

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
        style={{ backgroundColor: checked ? LIME : '#E2E8F0' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle } from 'lucide-react';

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function validCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

const PIX_TYPES = [
  { value: 'cpf',       label: 'CPF' },
  { value: 'email',     label: 'E-mail' },
  { value: 'telefone',  label: 'Telefone (Celular)' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

function pixPlaceholder(type) {
  if (type === 'cpf')       return '000.000.000-00';
  if (type === 'email')     return 'seu@email.com';
  if (type === 'telefone')  return '(62) 99999-0000';
  if (type === 'aleatoria') return 'Cole sua chave aleatória (UUID)';
  return 'Sua chave PIX';
}

function applyPixMask(value, type) {
  if (type === 'cpf')      return maskCPF(value);
  if (type === 'telefone') return maskPhone(value);
  return value;
}

export default function CadastroIndicador() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '', cpf: '', whatsapp: '', email: '',
    pix_key_type: 'cpf', pix_key: '', password: '', confirmPassword: '', terms: false,
  });
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Nome obrigatório';
    const rawCpf = form.cpf.replace(/\D/g, '');
    if (!rawCpf) e.cpf = 'CPF obrigatório';
    else if (!validCPF(rawCpf)) e.cpf = 'CPF inválido';
    if (!form.whatsapp) e.whatsapp = 'WhatsApp obrigatório';

    const pix = form.pix_key.trim();
    if (!pix) {
      e.pix_key = 'Chave PIX obrigatória';
    } else if (form.pix_key_type === 'cpf') {
      if (!validCPF(pix)) e.pix_key = 'CPF inválido como chave PIX';
    } else if (form.pix_key_type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pix)) e.pix_key = 'E-mail inválido';
    } else if (form.pix_key_type === 'telefone') {
      if (pix.replace(/\D/g, '').length < 11) e.pix_key = 'Telefone deve ter 11 dígitos com DDD';
    } else if (form.pix_key_type === 'aleatoria') {
      if (pix.length < 32) e.pix_key = 'Chave aleatória deve ter no mínimo 32 caracteres';
    }

    if (!form.password) e.password = 'Senha obrigatória';
    else if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'As senhas não coincidem';
    if (!form.terms) e.terms = 'Você precisa aceitar os termos';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await api.post('/indicators/register', {
        name: form.name.trim(),
        cpf: form.cpf.replace(/\D/g, ''),
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        email: form.email.trim() || undefined,
        pix_key_type: form.pix_key_type,
        pix_key: form.pix_key.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao enviar cadastro';
      if (err.response?.status === 409) {
        setErrors({ cpf: msg });
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10 max-w-md w-full text-center text-white">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Cadastro recebido!</h2>
          <p className="text-white/60 mb-6">
            Seu cadastro foi enviado com sucesso. Nossa equipe irá analisar e aprovar em até 24 horas úteis.
            Você receberá uma notificação por e-mail (se informado) quando for aprovado.
          </p>
          <p className="text-white/40 text-sm mb-8">
            Após aprovação, acesse o portal com seu CPF, e-mail ou WhatsApp e a senha cadastrada.
          </p>
          <Link to="/login" className="inline-block bg-[#0C2D48] hover:bg-[#5a1eaf] text-white font-semibold px-8 py-3 rounded-xl transition-all">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0a1e] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link to="/seja-indicador" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="text-center mb-8">
          <p className="text-[#C9A84C] text-xs font-bold uppercase tracking-[4px] mb-2">Grupo Movv</p>
          <h1 className="text-3xl font-black text-white">Cadastro de Indicador</h1>
          <p className="text-white/50 text-sm mt-2">Indique Azul e Ganhe — Cadastro gratuito</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Nome completo *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Seu nome completo"
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.name ? 'border-red-500' : 'border-white/20'}`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* CPF */}
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">CPF *</label>
            <input
              type="text"
              value={form.cpf}
              onChange={e => set('cpf', maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.cpf ? 'border-red-500' : 'border-white/20'}`}
            />
            {errors.cpf && <p className="text-red-400 text-xs mt-1">{errors.cpf}</p>}
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">WhatsApp *</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={e => set('whatsapp', maskPhone(e.target.value))}
              placeholder="(62) 99999-0000"
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.whatsapp ? 'border-red-500' : 'border-white/20'}`}
            />
            {errors.whatsapp && <p className="text-red-400 text-xs mt-1">{errors.whatsapp}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">E-mail (opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors"
            />
          </div>

          {/* Tipo PIX + Chave */}
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Tipo da chave PIX *</label>
            <select
              value={form.pix_key_type}
              onChange={e => { set('pix_key_type', e.target.value); set('pix_key', ''); }}
              className="w-full border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0C2D48] transition-colors"
              style={{ backgroundColor: '#1a0a3e' }}
            >
              {PIX_TYPES.map(t => (
                <option key={t.value} value={t.value} style={{ backgroundColor: '#1a0a3e' }}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Chave PIX *</label>
            <input
              type={form.pix_key_type === 'email' ? 'email' : 'text'}
              value={form.pix_key}
              onChange={e => set('pix_key', applyPixMask(e.target.value, form.pix_key_type))}
              placeholder={pixPlaceholder(form.pix_key_type)}
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.pix_key ? 'border-red-500' : 'border-white/20'}`}
            />
            {errors.pix_key && <p className="text-red-400 text-xs mt-1">{errors.pix_key}</p>}
          </div>

          {/* Senha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Senha *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mín. 6 caracteres"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.password ? 'border-red-500' : 'border-white/20'}`}
              />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Confirmar senha *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Repita a senha"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#0C2D48] transition-colors ${errors.confirmPassword ? 'border-red-500' : 'border-white/20'}`}
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>

          {/* Termos */}
          <div>
            <label className={`flex items-start gap-3 cursor-pointer ${errors.terms ? 'text-red-400' : 'text-white/60'}`}>
              <input
                type="checkbox"
                checked={form.terms}
                onChange={e => set('terms', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#0C2D48]"
              />
              <span className="text-sm">
                Li e aceito os{' '}
                <Link to="/termos-indicador" target="_blank" className="text-[#C9A84C] underline">
                  Termos de Uso do Programa Indique Azul e Ganhe
                </Link>
              </span>
            </label>
            {errors.terms && <p className="text-red-400 text-xs mt-1 ml-7">{errors.terms}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0C2D48] hover:bg-[#5a1eaf] disabled:opacity-50 text-white font-bold text-lg py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : 'Enviar Cadastro'}
          </button>

          <p className="text-center text-white/40 text-xs">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#C9A84C] underline">Fazer login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

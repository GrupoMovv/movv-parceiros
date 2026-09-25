import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CaretDown } from '@phosphor-icons/react';
import api from '../../../services/api';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos, validCPF, maskCpf, maskTelefone, telefoneValido } from '../../../utils/documentos';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, Aviso } from './AcessoUi';

const SENHA_MIN = 6;

// Fluxo 3 do /acesso — outros segmentos (posto, restaurante, hotel,
// indústria...). Tela única. Obrigatórios: nome, WhatsApp e senha; CPF e os
// dados de empresa são opcionais. Conta 'cliente': usa o marketplace, sem
// carteirinha nem preço de associado.
export default function AcessoBasico() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome_completo: '', whatsapp: '', senha: '', confirmar: '', cpf: '', empresa: '', cargo: '', segmento: '' });
  const [maisDados, setMaisDados] = useState(false);
  const [segmentos, setSegmentos] = useState([]);
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/public/acesso/segmentos').then(res => setSegmentos(res.data)).catch(() => {});
  }, []);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(x => ({ ...x, [campo]: null }));
  }

  function validar() {
    const e = {};
    const nome = form.nome_completo.trim();
    if (nome.length < 3 || !nome.includes(' ')) e.nome_completo = 'Digite seu nome e sobrenome.';
    if (!telefoneValido(form.whatsapp)) e.whatsapp = 'Digite o WhatsApp com DDD. Ex.: (64) 99999-9999';
    if (form.senha.length < SENHA_MIN) e.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (form.senha !== form.confirmar) e.confirmar = 'As senhas não são iguais.';
    if (soDigitos(form.cpf) && !validCPF(form.cpf)) {
      e.cpf = 'CPF inválido — confira ou deixe em branco.';
      setMaisDados(true);
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    setFalha(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const cpfDigits = soDigitos(form.cpf) || null;
      const whatsapp = soDigitos(form.whatsapp);
      const res = await api.post('/public/acesso/basico', {
        nome_completo: form.nome_completo,
        whatsapp,
        senha: form.senha,
        cpf: cpfDigits,
        empresa: form.empresa || null,
        cargo: form.cargo || null,
        segmento: form.segmento || null,
        aceite_comunicacao: aceite,
      });
      const ok = await entrarNoPainelSeguro(res.data.token, { cpf: cpfDigits, whatsapp });
      if (!ok) {
        setFalha({ error: 'Sua conta foi criada, mas não conseguimos entrar agora. Faça login.', code: 'JA_TEM_CONTA' });
        return;
      }
      toast.success(`Bem-vindo(a), ${res.data.nome_curto}! 🎉`);
      navigate('/marketplace', { replace: true });
    } catch (err) {
      const d = err.response?.data || {};
      if (d.code) setFalha({ error: d.error, code: d.code });
      else if (d.campo) {
        setErros(x => ({ ...x, [d.campo]: d.error }));
        if (['cpf', 'segmento'].includes(d.campo)) setMaisDados(true);
      } else setFalha({ error: d.error || 'Não conseguimos concluir agora. Verifique sua internet e tente de novo.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <CascaAcesso
      titulo="Cadastro básico"
      subtitulo="Posto, restaurante, hotel, indústria... Leva 1 minuto."
      voltarPara="/acesso"
      mensagemWhatsapp="Olá! Estou me cadastrando no IUB MAIS+ e preciso de ajuda."
    >
      <Cartao>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Campo label="Nome completo" erro={erros.nome_completo}>
            <input className="input" autoComplete="name" autoFocus value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} />
          </Campo>

          <Campo label="WhatsApp" erro={erros.whatsapp} dica="Você entra com ele e recupera a senha por ele.">
            <input className="input" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={e => set('whatsapp', maskTelefone(e.target.value))} placeholder="(64) 99999-9999" />
          </Campo>

          <Campo label="Crie uma senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
            <InputSenha value={form.senha} onChange={e => set('senha', e.target.value)} />
          </Campo>

          <Campo label="Confirme a senha" erro={erros.confirmar}>
            <InputSenha value={form.confirmar} onChange={e => set('confirmar', e.target.value)} />
          </Campo>

          <div className="border border-slate-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setMaisDados(v => !v)}
              className="w-full flex items-center justify-between px-4 min-h-[48px] text-sm font-semibold text-slate-700"
            >
              Mais dados (opcional): CPF, empresa, cargo
              <CaretDown size={16} className={`transition-transform ${maisDados ? 'rotate-180' : ''}`} />
            </button>
            {maisDados && (
              <div className="px-4 pb-4 space-y-4">
                <Campo label="CPF" erro={erros.cpf} dica="Se informar, você também pode entrar com o CPF.">
                  <input className="input" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" />
                </Campo>
                <Campo label="Empresa onde trabalha">
                  <input className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)} />
                </Campo>
                <Campo label="Cargo">
                  <input className="input" value={form.cargo} onChange={e => set('cargo', e.target.value)} />
                </Campo>
                {segmentos.length > 0 && (
                  <Campo label="Segmento" erro={erros.segmento}>
                    <select className="input" value={form.segmento} onChange={e => set('segmento', e.target.value)}>
                      <option value="">Selecione</option>
                      {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Campo>
                )}
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-5 h-5 accent-violet-700 flex-shrink-0" />
            Quero receber ofertas e novidades do IUB MAIS+ pelo WhatsApp.
          </label>

          {falha && (
            <div className="space-y-3">
              <Aviso tipo={falha.code ? 'info' : 'erro'} titulo={falha.error} />
              {falha.code === 'JA_TEM_CONTA' && (
                <Link to="/entrar" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>FAZER LOGIN</Link>
              )}
              {falha.code === 'JA_E_ASSOCIADO' && (
                <Link to="/acesso/associado" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>SOU ASSOCIADO SECI</Link>
              )}
            </div>
          )}

          <BotaoPrimario carregando={enviando}>CRIAR MINHA CONTA</BotaoPrimario>
        </form>
      </Cartao>

      <p className="text-center text-white/80 text-sm mt-6">
        Trabalha no comércio? <Link to="/acesso/associado" className="font-bold text-white underline underline-offset-4">Sou associado SECI</Link>
      </p>
    </CascaAcesso>
  );
}

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiPainel, { setPainelToken } from '../../../../services/apiPainel';
import InputDataBR from '../../Cadastro/InputDataBR';
import { ROXO } from '../theme';

function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Formulário puro (sem chrome de modal) — reaproveitado dentro do
// ModalEntrar (fluxo "Entrar" da navbar) e direto nas páginas de
// produto/promoção (CTA "Sou associado — Fazer login").
export default function LoginAssociadoForm({ onSuccess }) {
  const [cpf, setCpf] = useState('');
  const [dataISO, setDataISO] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const cpfDigits = cpf.replace(/\D/g, '');
  const podeEnviar = cpfDigits.length === 11 && Boolean(dataISO) && !enviando;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await apiPainel.post('/public/cadastro/login', { cpf: cpfDigits, data_nascimento: dataISO });
      setPainelToken(res.data.token);
      const me = await apiPainel.get('/public/painel/me');
      toast.success(`Bem-vindo(a), ${res.data.nome_curto || me.data.nome_completo}!`);
      onSuccess(me.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) setErro('CPF não encontrado ou carteirinha inativa.');
      else if (status === 401) setErro(err.response?.data?.error || 'Data de nascimento não confere.');
      else if (status === 429) setErro(err.response?.data?.error || 'Muitas tentativas. Tente novamente mais tarde.');
      else setErro('Erro ao entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">CPF</label>
        <input
          type="text" inputMode="numeric" placeholder="000.000.000-00" autoFocus
          className="input" value={cpf} onChange={e => setCpf(maskCPF(e.target.value))}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Data de nascimento</label>
        <InputDataBR valueISO={null} onChangeISO={setDataISO} />
      </div>

      {erro && <p className="text-red-500 text-xs">{erro}</p>}

      <button
        type="submit" disabled={!podeEnviar}
        className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-50"
        style={{ backgroundColor: ROXO }}
      >
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Entrar
      </button>
    </form>
  );
}

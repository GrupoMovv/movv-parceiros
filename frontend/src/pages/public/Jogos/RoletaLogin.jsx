import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { getPainelToken } from '../../../services/apiPainel';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import MascoteIubMais from '../../../components/MascoteIubMais';
import InputDataBR from '../Cadastro/InputDataBR';

function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
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

// Login rápido só pra quem quer jogar — versão enxuta do fluxo de
// /cadastrar (que tem a tela "3 opções": ver carteirinha / login /
// atualizar cadastro). Quem clica em "🎡 JOGAR" já quer JOGAR, não editar
// dados nem ver a carteirinha, então aqui é só CPF + nascimento -> sessão
// -> /jogar, sem telas intermediárias. Reusa o mesmo endpoint de login e a
// mesma trava de segurança pós-login do /cadastrar (entrarNoPainelSeguro).
export default function RoletaLogin() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [dataISO, setDataISO] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  // Já logado (bookmark antigo, botão voltar etc.) — não precisa ver o
  // formulário de novo, já vai direto jogar.
  useEffect(() => {
    if (getPainelToken()) navigate('/jogar', { replace: true });
  }, [navigate]);

  async function handleEntrar(e) {
    e.preventDefault();
    const digits = cpf.replace(/\D/g, '');
    if (!validCPF(digits)) { setErro('CPF inválido'); return; }
    if (!dataISO) { setErro('Preencha sua data de nascimento'); return; }

    setErro(null);
    setEnviando(true);
    try {
      const res = await api.post('/public/cadastro/login', { cpf: digits, data_nascimento: dataISO });
      const ok = await entrarNoPainelSeguro(res.data.token, digits);
      if (!ok) { setErro('Não deu pra confirmar sua sessão. Tente de novo.'); return; }
      navigate('/jogar');
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao entrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro px-4 py-10">
      <MascoteIubMais tamanho="large" animacao="float" />
      <h1 className="text-2xl sm:text-3xl font-black text-white mt-2 text-center">Entre pra jogar 🎡</h1>
      <p className="text-white/80 text-sm mt-1 text-center">É rapidinho — só CPF e data de nascimento</p>

      <form onSubmit={handleEntrar} className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm mt-6 space-y-4">
        <div>
          <label className="label">CPF</label>
          <input
            type="text" inputMode="numeric" autoFocus className="input" placeholder="000.000.000-00"
            value={maskCPF(cpf)} onChange={e => setCpf(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Data de nascimento</label>
          <InputDataBR valueISO={dataISO} onChangeISO={setDataISO} />
        </div>

        {erro && <p className="text-red-500 text-xs text-center">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="btn-iub-dourado w-full text-base sm:text-lg py-3.5 disabled:opacity-50"
        >
          {enviando ? 'Entrando...' : '🎡 ENTRAR E JOGAR'}
        </button>

        <Link to="/cadastrar" className="block text-center text-xs text-iub-cinza underline">
          Não tenho cadastro
        </Link>
      </form>
    </div>
  );
}

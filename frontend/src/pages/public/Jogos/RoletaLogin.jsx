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
  // CPF digitado que não existe na base — guarda pra levar pro cadastro já
  // preenchido, em vez de a pessoa digitar de novo.
  const [cpfNaoEncontrado, setCpfNaoEncontrado] = useState(null);

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
      // "CPF não encontrado" não é erro da pessoa — é a primeira vez dela
      // aqui. Vira convite, não mensagem seca em vermelho.
      if (err.response?.status === 404) { setCpfNaoEncontrado(digits); return; }
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

        {/* Era um link em letras miúdas que ninguém lia. Virou CTA de
            verdade — é por aqui que entra associado novo. */}
        <div className="pt-1">
          <p className="text-center text-sm font-semibold text-iub-roxo-escuro">Ainda não tem conta?</p>
          <p className="text-center text-xs text-iub-cinza mt-0.5">Cadastre-se em 1 minuto — grátis para associados SECI</p>
          <Link
            to="/cadastrar"
            className="mt-2.5 w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl font-black text-base"
            style={{ backgroundColor: '#FFB800', color: '#0F0F14' }}
          >
            ✨ CADASTRAR AGORA
          </Link>
        </div>
      </form>

      {cpfNaoEncontrado && (
        <ModalCpfNaoEncontrado
          onCriarConta={() => navigate('/cadastrar', { state: { cpf: cpfNaoEncontrado } })}
          onCorrigir={() => { setCpfNaoEncontrado(null); setCpf(''); }}
        />
      )}
    </div>
  );
}

// "CPF não cadastrado" espantava quem chegava pela primeira vez. Aqui a
// mesma situação vira convite, e o CPF digitado segue pro cadastro.
function ModalCpfNaoEncontrado({ onCriarConta, onCorrigir }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.75)' }}>
      <div className="w-full max-w-sm bg-white rounded-[2rem] p-7 text-center shadow-2xl">
        <div className="text-4xl">🤔</div>
        <h2 className="text-slate-900 font-bold text-lg mt-3">CPF não encontrado</h2>
        <p className="text-slate-600 text-sm mt-2">
          Parece que essa é sua <strong>primeira vez</strong> no IUB MAIS+! Vamos criar sua conta grátis?
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button
            type="button" onClick={onCriarConta}
            className="w-full min-h-[56px] rounded-2xl font-bold text-white text-base"
            style={{ backgroundColor: '#4C1D95' }}
          >
            ✨ SIM, CRIAR CONTA
          </button>
          <button
            type="button" onClick={onCorrigir}
            className="w-full min-h-[48px] rounded-2xl font-semibold text-slate-600 bg-slate-100"
          >
            Digitei o CPF errado
          </button>
        </div>
      </div>
    </div>
  );
}

import apiPainel, { setPainelToken } from '../services/apiPainel';

// Trava de segurança pós-login: sessão pública é só um JWT (sem sessão no
// servidor) — se por qualquer motivo o token guardado não corresponder a
// quem a pessoa acabou de autenticar (ex.: uma aba antiga, uma extensão
// mexendo no localStorage, um bug futuro que ninguém pegou em review), essa
// checagem barra ANTES de mostrar o painel/jogo de outra pessoa, em vez de
// confiar cegamente que "o token que acabei de setar é o certo".
// Extraído de CadastroPublico.jsx pra ser reusado por qualquer outra tela
// de login (RoletaLogin.jsx, /acesso).
function cpfParcialEsperado(cpfDigits) {
  return `${cpfDigits.slice(0, 3)}.***.***-${cpfDigits.slice(9, 11)}`;
}

// `identificador`: o CPF (string, como sempre foi) ou { cpf, whatsapp } —
// conta 'cliente' do /acesso pode não ter CPF, aí confere pelo WhatsApp.
export async function entrarNoPainelSeguro(token, identificador) {
  const { cpf, whatsapp } = typeof identificador === 'string' ? { cpf: identificador } : (identificador || {});
  setPainelToken(token);
  try {
    const res = await apiPainel.get('/public/painel/me');
    const confere = cpf
      ? res.data.cpf_parcial === cpfParcialEsperado(cpf)
      : Boolean(whatsapp) && String(res.data.whatsapp || '').replace(/\D/g, '') === whatsapp;
    if (!confere) {
      console.error('[seguranca] a sessão do painel não bate com quem acabou de autenticar — sessão abortada');
      setPainelToken(null);
      return false;
    }
    return true;
  } catch {
    setPainelToken(null);
    return false;
  }
}

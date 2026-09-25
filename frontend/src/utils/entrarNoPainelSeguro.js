import apiPainel, { setPainelToken } from '../services/apiPainel';

// Trava de segurança pós-login: sessão pública é só um JWT (sem sessão no
// servidor) — se por qualquer motivo o token guardado não corresponder a
// quem a pessoa acabou de autenticar (ex.: uma aba antiga, uma extensão
// mexendo no localStorage, um bug futuro que ninguém pegou em review), essa
// checagem barra ANTES de mostrar o painel/jogo de outra pessoa, em vez de
// confiar cegamente que "o token que acabei de setar é o certo".
// Extraído de CadastroPublico.jsx pra ser reusado por qualquer outra tela
// de login (RoletaLogin.jsx, /entrar).
function cpfParcialEsperado(cpfDigits) {
  return `${cpfDigits.slice(0, 3)}.***.***-${cpfDigits.slice(9, 11)}`;
}

// `identificador`: o CPF digitado (string, como sempre foi) ou
// { cpfParcial } devolvido pelo login do /entrar — lá a pessoa pode ter
// entrado pelo WhatsApp, então quem diz qual conta autenticou é o servidor.
export async function entrarNoPainelSeguro(token, identificador) {
  const esperado = typeof identificador === 'string'
    ? cpfParcialEsperado(identificador)
    : identificador?.cpfParcial || null;
  setPainelToken(token);
  try {
    const res = await apiPainel.get('/public/painel/me');
    if (!esperado || res.data.cpf_parcial !== esperado) {
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

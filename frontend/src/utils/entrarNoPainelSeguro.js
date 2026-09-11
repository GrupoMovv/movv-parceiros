import apiPainel, { setPainelToken } from '../services/apiPainel';

// Trava de segurança pós-login: sessão pública é só um JWT (sem sessão no
// servidor) — se por qualquer motivo o token guardado não corresponder ao
// CPF que a pessoa acabou de autenticar (ex.: uma aba antiga, uma extensão
// mexendo no localStorage, um bug futuro que ninguém pegou em review), essa
// checagem barra ANTES de mostrar o painel/jogo de outra pessoa, em vez de
// confiar cegamente que "o token que acabei de setar é o certo".
// Extraído de CadastroPublico.jsx pra ser reusado por qualquer outra tela
// de login por CPF+nascimento (ex.: RoletaLogin.jsx) sem duplicar a lógica.
function cpfParcialEsperado(cpfDigits) {
  return `${cpfDigits.slice(0, 3)}.***.***-${cpfDigits.slice(9, 11)}`;
}

export async function entrarNoPainelSeguro(token, cpfDigits) {
  setPainelToken(token);
  try {
    const res = await apiPainel.get('/public/painel/me');
    if (res.data.cpf_parcial !== cpfParcialEsperado(cpfDigits)) {
      console.error('[seguranca] cpf_parcial do painel nao bate com o CPF autenticado — sessao abortada', {
        esperado: cpfParcialEsperado(cpfDigits), recebido: res.data.cpf_parcial,
      });
      setPainelToken(null);
      return false;
    }
    return true;
  } catch {
    setPainelToken(null);
    return false;
  }
}

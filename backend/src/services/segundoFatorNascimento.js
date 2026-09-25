const db = require('../config/database');

// Data de nascimento como segundo fator do associado (login público antigo
// por CPF + nascimento, e o /acesso quando um associado que já existe
// cria a senha). 3 falhas consecutivas (janela de 15min) bloqueiam por
// 30min; ultimo_login_publico guarda a última falha e serve tanto pra
// resetar a janela quanto pra calcular o fim do bloqueio.
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 30 * 60 * 1000;
const MAX_TENTATIVAS = 3;

function isoDoBanco(data) {
  return data ? new Date(data).toISOString().slice(0, 10) : null;
}

/**
 * @param associado  linha de sindicato_associados (precisa de id, data_nascimento,
 *                   tentativas_login_publico, ultimo_login_publico)
 * @param dataNascimento  'YYYY-MM-DD' digitada
 * @returns {Promise<{ ok: true } | { ok: false, status: number, body: object }>}
 */
async function conferirNascimento(associado, dataNascimento) {
  const agora = Date.now();
  const ultimaFalha = associado.ultimo_login_publico ? new Date(associado.ultimo_login_publico).getTime() : null;
  const bloqueadoAte = ultimaFalha ? ultimaFalha + BLOQUEIO_MS : null;

  if (associado.tentativas_login_publico >= MAX_TENTATIVAS && bloqueadoAte && agora < bloqueadoAte) {
    const minutosRestantes = Math.ceil((bloqueadoAte - agora) / 60000);
    return {
      ok: false, status: 429,
      body: { error: `Muitas tentativas incorretas. Tente novamente em ${minutosRestantes} min ou fale com o Sindicato.`, bloqueado: true },
    };
  }

  if (isoDoBanco(associado.data_nascimento) !== dataNascimento) {
    const dentroDaJanela = ultimaFalha && (agora - ultimaFalha) <= JANELA_TENTATIVAS_MS;
    const novasTentativas = dentroDaJanela ? associado.tentativas_login_publico + 1 : 1;
    await db.query(
      'UPDATE sindicato_associados SET tentativas_login_publico = $1, ultimo_login_publico = NOW() WHERE id = $2',
      [novasTentativas, associado.id]
    );
    if (novasTentativas >= MAX_TENTATIVAS) {
      return {
        ok: false, status: 429,
        body: { error: 'Muitas tentativas incorretas. Tente novamente em 30 min ou fale com o Sindicato.', bloqueado: true },
      };
    }
    return {
      ok: false, status: 401,
      body: { error: 'Data de nascimento não confere', tentativas_restantes: MAX_TENTATIVAS - novasTentativas },
    };
  }

  if (associado.tentativas_login_publico > 0) {
    await db.query('UPDATE sindicato_associados SET tentativas_login_publico = 0 WHERE id = $1', [associado.id]);
  }
  return { ok: true };
}

module.exports = { conferirNascimento };

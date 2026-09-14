// Privacidade no ranking dos Joguinhos (LGPD) — nunca expor nome_completo
// de um associado pra outro. "Idevaldo dos Santos Junior" vira
// "Idevaldo S.": primeiro nome + inicial do primeiro sobrenome que não
// seja conectivo (pula "de/da/do/das/dos/e", senão a inicial sai errada
// tipo "Idevaldo D." de "dos"). Nome de uma palavra só fica como está.
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function anonimizarNome(nomeCompleto) {
  const palavras = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palavras.length <= 1) return palavras[0] || '';

  const [primeiroNome, ...resto] = palavras;
  const sobrenomeUtil = resto.find(p => !CONECTIVOS.has(p.toLowerCase()));
  if (!sobrenomeUtil) return primeiroNome;

  return `${primeiroNome} ${sobrenomeUtil[0].toUpperCase()}.`;
}

module.exports = { anonimizarNome };

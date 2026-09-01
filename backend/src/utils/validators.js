function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function isValidCPF(cpf) {
  const c = onlyDigits(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10], 10);
}

function isValidCNPJ(cnpj) {
  const c = onlyDigits(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;

  const calcDigito = (base) => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base12 = c.slice(0, 12);
  const d1 = calcDigito(base12);
  const d2 = calcDigito(base12 + String(d1));
  return c === base12 + String(d1) + String(d2);
}

module.exports = { onlyDigits, isValidCPF, isValidCNPJ };

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

// Empresa de teste nunca tem CNPJ (migration 074 trava no banco também).
const EMPRESA_TESTE_SEM_CNPJ = 'Empresa de teste não pode ter CNPJ — um CNPJ digitado aqui é de uma empresa real. Use só o CNAE.';

// CPF para tela, log e relatório: 431.***.***-93 (nunca o CPF completo)
function mascararCpf(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return d ? '***' : null;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

// CNPJ para tela, log e relatório: 12.***.***/****-90
function mascararCnpj(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return d ? '***' : null;
  return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`;
}

// CPF ou CNPJ (pelo tamanho)
const mascararDocumento = doc => {
  const d = onlyDigits(doc);
  if (!d) return null;
  return d.length === 14 ? mascararCnpj(d) : mascararCpf(d);
};

// Chave PIX (Partner, 15/10/2026). Tipos iguais aos dos indicadores, mais
// cnpj. Devolve { chave } normalizada ou { erro } em português.
const TIPOS_PIX = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];
function validarPix(tipo, valor) {
  const v = String(valor ?? '').trim();
  if (!TIPOS_PIX.includes(tipo)) return { erro: 'Escolha o tipo da chave PIX.' };
  if (!v) return { erro: 'Informe a chave PIX.' };
  if (tipo === 'cpf') {
    const d = onlyDigits(v);
    return isValidCPF(d) ? { chave: d } : { erro: 'CPF da chave PIX inválido.' };
  }
  if (tipo === 'cnpj') {
    const d = onlyDigits(v);
    return isValidCNPJ(d) ? { chave: d } : { erro: 'CNPJ da chave PIX inválido.' };
  }
  if (tipo === 'email') {
    const e = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { chave: e } : { erro: 'E-mail da chave PIX inválido.' };
  }
  if (tipo === 'telefone') {
    let d = onlyDigits(v);
    if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
    // celular: DDD (11 a 99) + 9 + 8 dígitos
    return /^[1-9][1-9]9\d{8}$/.test(d) ? { chave: `+55${d}` } : { erro: 'Celular da chave PIX inválido (DDD + 9 dígitos).' };
  }
  const a = v.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a)
    ? { chave: a } : { erro: 'Chave aleatória inválida (formato 0000aaaa-00aa-00aa-00aa-000000aaaaaa).' };
}

// Chave PIX para tela, log e relatório (nunca a chave inteira)
function mascararPix(tipo, chave) {
  const c = String(chave ?? '');
  if (!c) return null;
  if (tipo === 'cpf') return mascararCpf(c);
  if (tipo === 'cnpj') return mascararCnpj(c);
  if (tipo === 'email') {
    const [u, dom] = c.split('@');
    return dom ? `${u.slice(0, 1)}***@${dom}` : '***';
  }
  if (tipo === 'telefone') return `+55 (${c.slice(-11, -9)}) *****-${c.slice(-4)}`;
  if (tipo === 'aleatoria') return `${c.slice(0, 4)}…${c.slice(-4)}`;
  return '***';
}

module.exports = {
  onlyDigits, isValidCPF, isValidCNPJ, mascararCpf, mascararCnpj, mascararDocumento,
  TIPOS_PIX, validarPix, mascararPix, EMPRESA_TESTE_SEM_CNPJ,
};

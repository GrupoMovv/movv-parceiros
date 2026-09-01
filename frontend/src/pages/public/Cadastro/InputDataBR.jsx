import { useState } from 'react';

function maskDataBR(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

function ehDataValida(d, m, y) {
  if (!y || y < 1900 || y > 2100) return false;
  if (!m || m < 1 || m > 12) return false;
  const diasNoMes = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d >= 1 && d <= diasNoMes[m - 1];
}

function calcularIdade(d, m, y) {
  const hoje = new Date();
  let idade = hoje.getFullYear() - y;
  const mesAtual = hoje.getMonth() + 1, diaAtual = hoje.getDate();
  if (mesAtual < m || (mesAtual === m && diaAtual < d)) idade--;
  return idade;
}

// ISO ("YYYY-MM-DD", ou um datetime completo — dependentes vêm do backend
// como timestamptz) -> "DD/MM/AAAA" pra exibir no input.
export function dataISOParaBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// Valida uma string já mascarada. Só retorna erro quando os 8 dígitos já
// foram digitados — enquanto a pessoa ainda está digitando, iso e erro
// ficam null (não trava o campo no meio da digitação).
export function validarDataBR(textoMascarado, { idadeMinima, idadeMaxima } = {}) {
  const digits = String(textoMascarado || '').replace(/\D/g, '');
  if (digits.length < 8) return { iso: null, erro: null };

  const d = parseInt(digits.slice(0, 2), 10);
  const m = parseInt(digits.slice(2, 4), 10);
  const y = parseInt(digits.slice(4, 8), 10);

  if (!ehDataValida(d, m, y)) return { iso: null, erro: 'Data inválida' };

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (new Date(y, m - 1, d) > hoje) return { iso: null, erro: 'Data não pode ser no futuro' };

  const idade = calcularIdade(d, m, y);
  if (idadeMinima != null && idade < idadeMinima) return { iso: null, erro: `Idade mínima: ${idadeMinima} anos` };
  if (idadeMaxima != null && idade > idadeMaxima) return { iso: null, erro: `Idade máxima: ${idadeMaxima} anos` };

  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, erro: null };
}

// Input livre com máscara DD/MM/AAAA. Não ressincroniza com `valueISO` após
// a montagem (só usa como valor inicial) — o pai deve dar um `key` estável
// e diferente quando quiser forçar um reset (ex.: trocar de dependente),
// senão digitação em andamento seria apagada a cada re-render do pai.
export default function InputDataBR({ valueISO, onChangeISO, idadeMinima, idadeMaxima, className, placeholder = 'DD/MM/AAAA', autoFocus }) {
  const [texto, setTexto] = useState(() => dataISOParaBR(valueISO));
  const [erro, setErro] = useState(null);

  function handleChange(e) {
    const masked = maskDataBR(e.target.value);
    setTexto(masked);
    const { iso, erro: err } = validarDataBR(masked, { idadeMinima, idadeMaxima });
    setErro(masked.replace(/\D/g, '').length === 8 ? err : null);
    onChangeISO(iso);
  }

  return (
    <div>
      <input
        type="text" inputMode="numeric" placeholder={placeholder} autoFocus={autoFocus}
        className={className || 'input'}
        value={texto}
        onChange={handleChange}
      />
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
    </div>
  );
}

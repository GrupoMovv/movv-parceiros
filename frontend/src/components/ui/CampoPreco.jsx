import { useEffect, useRef, useState } from 'react';

function formatarCentavos(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function paraDisplay(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numero = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(numero)) return '';
  return formatarCentavos(Math.round(numero * 100));
}

// Máscara de moeda BR "digitando da direita pra esquerda" (como um
// terminal de PDV): cada tecla só mexe nos dígitos, o cursor sempre fica
// no fim. `value`/`onChange` continuam sendo decimal em string (ex.
// "45.00"), então os forms que já faziam parseFloat(form.preco) não
// precisam mudar nada além de trocar o <input> por este componente.
export default function CampoPreco({ value, onChange, className, placeholder = 'R$ 0,00' }) {
  const inputRef = useRef(null);
  const [display, setDisplay] = useState(() => paraDisplay(value));

  useEffect(() => { setDisplay(paraDisplay(value)); }, [value]);

  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  }, [display]);

  function handleChange(e) {
    const digitos = e.target.value.replace(/\D/g, '');
    const centavos = parseInt(digitos || '0', 10);
    onChange((centavos / 100).toFixed(2));
  }

  function irParaOFim(e) {
    const len = e.target.value.length;
    e.target.setSelectionRange(len, len);
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={irParaOFim}
      onClick={irParaOFim}
      placeholder={placeholder}
      className={className}
    />
  );
}

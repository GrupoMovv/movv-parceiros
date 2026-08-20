import { useState } from 'react';

// Separador de milhar, sem decimais.
export default function IntegerInput({ value, onChange, placeholder, className }) {
  const toDisplay = raw => {
    const n = parseInt(raw);
    if (!n || isNaN(n)) return '';
    return n.toLocaleString('pt-BR');
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  const handleChange = e => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const num = parseInt(digits, 10);
    setDisplay(num.toLocaleString('pt-BR'));
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className || 'input'}
      value={display}
      onChange={handleChange}
      placeholder={placeholder || '0'}
    />
  );
}

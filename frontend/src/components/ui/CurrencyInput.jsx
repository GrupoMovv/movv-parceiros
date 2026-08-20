import { useState } from 'react';

// Máscara BRL enquanto digita — armazena o valor bruto (número) no form,
// exibe formatado localmente. Ex.: digitar "1000" → exibe "R$ 10,00".
export default function CurrencyInput({ value, onChange, placeholder, className }) {
  const toDisplay = raw => {
    const n = parseFloat(raw);
    if (!n || isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  const handleChange = e => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const num = parseInt(digits, 10) / 100;
    setDisplay(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        className={`${className || 'input'} pl-9`}
        value={display}
        onChange={handleChange}
        placeholder={placeholder || '0,00'}
      />
    </div>
  );
}

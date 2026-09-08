import { useEffect, useState } from 'react';

// Colunas responsivas das vitrines de produto da home — espelha exatamente
// os breakpoints do Tailwind (sm/md/lg/xl) usados no grid dessas vitrines,
// pra paginação em JS (quantos produtos cabem numa "página") bater com o
// que a CSS realmente desenha. Usado tanto pela paginação (VitrinePaginada)
// quanto por quem precisa saber de antemão quantos produtos garantem pelo
// menos 2 páginas cheias (VitrineRotativa).
const BREAKPOINTS = [
  { query: '(min-width: 1280px)', colunas: 6 },
  { query: '(min-width: 1024px)', colunas: 5 },
  { query: '(min-width: 768px)', colunas: 4 },
  { query: '(min-width: 640px)', colunas: 3 },
];

function calcularColunas() {
  if (typeof window === 'undefined') return 6;
  const bp = BREAKPOINTS.find(b => window.matchMedia(b.query).matches);
  return bp ? bp.colunas : 2;
}

export function useColunas() {
  const [colunas, setColunas] = useState(calcularColunas);

  useEffect(() => {
    function aoRedimensionar() { setColunas(calcularColunas()); }
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  return colunas;
}

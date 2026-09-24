import { DOURADO } from '../theme';

// Selinho dourado dos itens do menu com `badge` (ex.: "EM BREVE"), no menu
// desktop (TopNav) e nas pills do MenuHorizontalMobile.
export default function BadgeMenu({ texto }) {
  return (
    <span
      className="text-[9px] font-black leading-none tracking-wide px-1.5 py-[3px] rounded-full whitespace-nowrap"
      style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
    >
      {texto}
    </span>
  );
}

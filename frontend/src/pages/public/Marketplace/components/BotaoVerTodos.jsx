import { ChevronRight } from 'lucide-react';
import { ROXO } from '../theme';

export default function BotaoVerTodos({ href, label = 'Ver todas' }) {
  return (
    <a
      href={href}
      className="flex-shrink-0 inline-flex items-center gap-0.5 text-sm font-semibold hover:underline"
      style={{ color: ROXO }}
    >
      {label} <ChevronRight className="w-3.5 h-3.5" />
    </a>
  );
}

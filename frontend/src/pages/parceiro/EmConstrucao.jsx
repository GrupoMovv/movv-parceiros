import { Construction } from 'lucide-react';
import { PRETO } from '../public/Marketplace/theme';

export default function ParceiroEmConstrucao({ titulo, texto }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Construction className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>{titulo}</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">{texto}</p>
    </div>
  );
}

import { AlertTriangle } from 'lucide-react';

// Chave PIX trocada nos últimos 7 dias (partner_pix_historico, migration 090):
// aviso antes do "Registrar PIX", para conferir a chave antes de pagar.
export default function AvisoPixAlterado({ item, className = '' }) {
  if (!item?.pix_alterada_em) return null;
  const data = new Date(item.pix_alterada_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const quem = (item.pix_alterada_por || '').replace(/ \(.*\)$/, '') || 'alguém';
  return (
    <p className={`flex items-start gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-left ${className}`}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
      <span>Chave PIX alterada em {data} por {quem}</span>
    </p>
  );
}

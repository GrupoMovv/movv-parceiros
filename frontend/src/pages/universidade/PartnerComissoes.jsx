import { Percent } from 'lucide-react';

// "Minhas comissões / Tabela vigente" do MOVV Partner. A apostila nunca traz
// percentual e manda consultar a tabela vigente aqui; a tabela vem depois, do
// motor de regras de comissão (Junior, 09/10/2026).
export default function PartnerComissoes() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card text-center py-10">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gold-gradient flex items-center justify-center"><Percent className="w-6 h-6 text-movv-900" /></div>
        <h1 className="mt-4 text-xl font-display font-semibold text-slate-900">Minhas comissões · Tabela vigente</h1>
        <p className="mt-2 text-slate-600 max-w-md mx-auto">
          A tabela de comissões vigente do MOVV Partner vai aparecer aqui, junto com as suas comissões.
          Enquanto isso, tire dúvidas sobre valores com a Central Movv.
        </p>
      </div>
    </div>
  );
}

// Termo IUB DISK BEBIDAS — aceite obrigatório pra ativar a extensão no
// painel do parceiro. Mudou o texto? Troca TERMO_VERSAO em
// backend/src/config/beer.js: quem aceitou a versão antiga precisa aceitar
// de novo no próximo salvamento.
export const ITENS_TERMO = [
  'O estabelecimento vende apenas produtos legais no Brasil.',
  'Possui CNPJ e alvará para venda de bebidas alcoólicas.',
  'Possui alvará sanitário para comidas prontas (quando vender comida pronta).',
  'Não vende bebida alcoólica nem cigarro para menores de 18 anos.',
  'Confere a idade do cliente na entrega, com documento com foto.',
  'Não cadastra produtos proibidos (vape, pod, cigarro eletrônico, drogas ilícitas, etc.).',
  'Responde solidariamente por qualquer descumprimento destes termos.',
  'O IUB pode remover produtos ou o estabelecimento sem aviso prévio se detectar irregularidade.',
  'O IUB é apenas VITRINE: não produz, não armazena, não manipula e não entrega os produtos.',
];

export default function TermoDiskBebidas({ aceito, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-800">Termos de uso IUB DISK BEBIDAS</p>
      <ol className="mt-2 space-y-1.5 text-xs text-slate-600 list-decimal pl-4 max-h-56 overflow-y-auto">
        {ITENS_TERMO.map(t => <li key={t}>{t}</li>)}
      </ol>
      <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={aceito} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-violet-700" />
        <span className="text-sm font-semibold text-slate-800">Li e concordo com os termos IUB DISK BEBIDAS</span>
      </label>
    </div>
  );
}

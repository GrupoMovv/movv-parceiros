// "Monte seu Drink" — fase 3 do roadmap. Aparece pra criar expectativa, mas
// é um <div> (não botão/link): não tem o que clicar ainda.
export default function BotaoMonteSeuDrink() {
  return (
    <div
      role="img"
      aria-label="Monte seu drink — em breve"
      title="Em desenvolvimento"
      className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 cursor-not-allowed select-none"
      style={{ backgroundColor: '#E5E7EB', color: '#6B7280' }}
    >
      <span className="text-sm sm:text-base font-black tracking-wide">🍸 MONTE SEU DRINK</span>
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ backgroundColor: '#D1D5DB', color: '#4B5563' }}>
        Em breve
      </span>
    </div>
  );
}

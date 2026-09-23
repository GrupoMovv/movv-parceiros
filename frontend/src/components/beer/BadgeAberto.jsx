// "● Aberto agora" / "● Fechado" — status MANUAL do estabelecimento (toggle
// "Aberto agora" do painel, beer_estabelecimentos.status_aberto), não o
// horário cadastrado: disk bebidas abre e fecha fora de horário fixo.
export default function BadgeAberto({ aberto, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}
      style={{ backgroundColor: aberto ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.14)', color: aberto ? '#86EFAC' : '#FCA5A5' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aberto ? '#22C55E' : '#EF4444' }} />
      {aberto ? 'Aberto agora' : 'Fechado'}
    </span>
  );
}

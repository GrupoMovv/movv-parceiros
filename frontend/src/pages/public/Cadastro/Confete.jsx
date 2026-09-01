const CORES = ['#D4AF37', '#B8E62C', '#FFFFFF', '#1E4A8A'];

// Confete leve em CSS puro (sem lib nova) — só pra tela final de sucesso.
export default function Confete() {
  const particulas = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.4,
    cor: CORES[i % CORES.length],
    tamanho: 6 + Math.random() * 6,
    rotacao: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[60]" aria-hidden="true">
      <style>{`
        @keyframes confete-cair {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {particulas.map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: p.tamanho,
            height: p.tamanho * 1.6,
            backgroundColor: p.cor,
            borderRadius: 2,
            transform: `rotate(${p.rotacao}deg)`,
            animation: `confete-cair ${p.duration}s ease-in ${p.delay}s 1 forwards`,
          }}
        />
      ))}
    </div>
  );
}

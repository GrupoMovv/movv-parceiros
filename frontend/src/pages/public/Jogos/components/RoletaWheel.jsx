// 8 setores — cores e prêmios pedidos no spec do jogo. desconto=100
// representa o prêmio "DIAMANTE" (produto grátis), sorteado raríssimo.
export const SETORES_ROLETA = [
  { desconto: 5, cor: '#22C55E', label: '5%' },
  { desconto: 10, cor: '#EAB308', label: '10%' },
  { desconto: 15, cor: '#F97316', label: '15%' },
  { desconto: 20, cor: '#EF4444', label: '20%' },
  { desconto: 25, cor: '#7C3AED', label: '25%' },
  { desconto: 30, cor: '#EC4899', label: '30%' },
  { desconto: 50, cor: '#FFB800', label: '50%' },
  { desconto: 100, cor: '#67E8F9', label: '💎' },
];

const FATIA_GRAUS = 360 / SETORES_ROLETA.length;

export function indiceDoSetor(desconto) {
  const i = SETORES_ROLETA.findIndex(s => s.desconto === desconto);
  return i === -1 ? 0 : i;
}

// Ângulo de rotação (em graus, cumulativo a partir de rotacaoAtual) pra
// fazer o setor `desconto` parar embaixo do ponteiro fixo no topo (12h).
// `voltas` controla o suspense (quantas voltas completas antes de frear).
export function calcularRotacaoAlvo(rotacaoAtual, desconto, voltas = 6) {
  const indice = indiceDoSetor(desconto);
  const centroSetor = indice * FATIA_GRAUS + FATIA_GRAUS / 2;
  // jitter pra não cair sempre bem no centro do setor (mais orgânico),
  // sem chegar perto da borda (evita parecer que caiu no setor vizinho)
  const jitter = (Math.random() - 0.5) * (FATIA_GRAUS * 0.6);
  // rotate(Rdeg) é sentido horário; pra o centro do setor (que começa a
  // `centroSetor` graus do topo) acabar embaixo do ponteiro fixo (0deg,
  // topo), R precisa ser (360 - centroSetor).
  const alvoAbsoluto = 360 - centroSetor + jitter;
  const rotacaoBase = rotacaoAtual - (rotacaoAtual % 360);
  return rotacaoBase + 360 * voltas + alvoAbsoluto;
}

function conicGradient() {
  const partes = SETORES_ROLETA.map((s, i) => `${s.cor} ${i * FATIA_GRAUS}deg ${(i + 1) * FATIA_GRAUS}deg`);
  return `conic-gradient(from 0deg, ${partes.join(', ')})`;
}

export default function RoletaWheel({ rotacao, girando }) {
  return (
    <div className="relative w-72 h-72 sm:w-96 sm:h-96 mx-auto select-none">
      {/* ponteiro fixo, topo */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-2 z-20"
        style={{
          width: 0, height: 0,
          borderLeft: '16px solid transparent',
          borderRight: '16px solid transparent',
          borderTop: '28px solid #FFB800',
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
        }}
      />

      {/* LEDs piscando na borda */}
      <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 6px #1F2937, 0 0 30px rgba(255,184,0,0.5)' }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full animate-pulse-slow"
            style={{
              backgroundColor: '#FFB800',
              top: '50%', left: '50%',
              transform: `rotate(${i * 22.5}deg) translate(0, -140px)`,
              animationDelay: `${(i % 4) * 0.2}s`,
              boxShadow: '0 0 6px #FFB800',
            }}
          />
        ))}
      </div>

      {/* roda */}
      <div
        className="absolute inset-3 rounded-full border-4 border-white shadow-2xl overflow-hidden"
        style={{
          background: conicGradient(),
          transform: `rotate(${rotacao}deg)`,
          transition: girando ? 'transform 5s cubic-bezier(0.12, 0.85, 0.18, 1)' : 'none',
        }}
      >
        {SETORES_ROLETA.map((s, i) => {
          const angulo = i * FATIA_GRAUS + FATIA_GRAUS / 2;
          return (
            <div
              key={s.desconto}
              className="absolute left-1/2 top-1/2 flex items-start justify-center"
              style={{ width: 2, height: '50%', transform: `rotate(${angulo}deg)`, transformOrigin: 'top' }}
            >
              <span
                className="font-black text-white drop-shadow text-sm sm:text-base mt-4 sm:mt-6"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* miolo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl sm:text-3xl">
          🎡
        </div>
      </div>
    </div>
  );
}

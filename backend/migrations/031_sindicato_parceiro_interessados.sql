-- Pagina "Planos" (modo Em Breve) do Portal do Parceiro: registra quem
-- clicou em "Notificar-me" pra cada plano pago, pra campanha de lancamento
-- futura e pro bonus de "Pioneiro" (3 meses gratis do plano).
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_parceiro_interessados (
  id               SERIAL PRIMARY KEY,
  parceiro_id      INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  plano_interesse  VARCHAR(50) NOT NULL CHECK (plano_interesse IN ('oficial', 'premium', 'master')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parceiro_id, plano_interesse)
);

CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_interessados_plano ON sindicato_parceiro_interessados(plano_interesse);

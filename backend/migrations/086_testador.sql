-- Acesso de testador (Junior, 08/10/2026): marca na conta de cliente que o
-- admin liga e desliga. Com ela, a pessoa vê e compra nas lojas de teste
-- (como o modo QA), sem precisar da senha de admin. Desliga sozinha:
-- vale até testador_ate (o admin liga por 30 dias). Cada ligar/desligar
-- fica registrado com quem fez.
ALTER TABLE sindicato_associados ADD COLUMN IF NOT EXISTS testador_ate TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS testador_registros (
  id              SERIAL PRIMARY KEY,
  associado_id    INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  acao            VARCHAR(10) NOT NULL CHECK (acao IN ('ligou', 'desligou')),
  ate             TIMESTAMPTZ,              -- até quando ficou ligado (só em 'ligou')
  por_partner_id  INTEGER,                  -- admin que fez (partners.id)
  em              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_testador_registros_associado ON testador_registros (associado_id, em DESC);

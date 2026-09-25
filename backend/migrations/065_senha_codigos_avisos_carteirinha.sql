-- Parte 4: "esqueci minha senha" por código no WhatsApp e avisos
-- automáticos da carteirinha (rotina diária do Render Cron Job).
-- Execute: node migrations/run.js

-- Código de 6 dígitos mandado por WhatsApp. O id (uuid) é o "pedido" que a
-- tela guarda entre os dois passos — não dá pra adivinhar. O código em si
-- fica só como hash.
CREATE TABLE IF NOT EXISTS senha_codigos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id  INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  codigo_hash   VARCHAR(100) NOT NULL,
  expira_em     TIMESTAMPTZ NOT NULL,
  tentativas    INTEGER NOT NULL DEFAULT 0,
  usado_em      TIMESTAMPTZ,
  ip            VARCHAR(64),
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_senha_codigos_associado ON senha_codigos(associado_id, criado_em);

-- Um aviso por carteirinha por tipo: `referencia` é a data de validade a
-- que o aviso se refere — renovou, a validade muda e o ciclo recomeça.
-- O UNIQUE é o que garante "nunca manda duplicado", mesmo com duas
-- execuções da rotina ao mesmo tempo.
CREATE TABLE IF NOT EXISTS carteirinha_avisos (
  id            SERIAL PRIMARY KEY,
  associado_id  INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('vence_30', 'vence_hoje', 'renovada', 'ativada')),
  referencia    DATE NOT NULL,
  enviado_em    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (associado_id, tipo, referencia)
);

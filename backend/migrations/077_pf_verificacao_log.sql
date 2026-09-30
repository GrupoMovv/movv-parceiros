-- Fila de verificação do Vendedor Pessoa Física (Junior, 30/09/2026): cada
-- aprovação/rejeição da identidade vira uma linha aqui. As fotos do
-- documento e da selfie são APAGADAS do Cloudinary na decisão (termos,
-- seção 5); fica só este registro: resultado, motivo, quem e quando.
CREATE TABLE IF NOT EXISTS pf_verificacao_log (
  id                SERIAL PRIMARY KEY,
  parceiro_id       INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  acao              VARCHAR(12) NOT NULL CHECK (acao IN ('aprovada', 'rejeitada')),
  motivo            TEXT,
  admin_id          INTEGER,
  admin_nome        VARCHAR(160),
  fotos_apagadas    BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enviado  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pf_verificacao_log_parceiro ON pf_verificacao_log (parceiro_id, created_at DESC);

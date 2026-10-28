-- Fecha Mês: avisos pelo WhatsApp às lojas (services/fechaMesAvisos.js).
-- Convite na segunda da semana do evento e lembrete do prazo na quinta,
-- uma vez por loja e por edição. A linha é gravada ANTES do envio: o
-- UNIQUE garante que o aviso nunca sai em dobro, nem com duas rodadas ao
-- mesmo tempo. Se o envio falha, a linha é apagada e a próxima rodada
-- (dentro da janela do aviso) tenta de novo.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS fecha_mes_avisos (
  id            SERIAL PRIMARY KEY,
  fecha_mes_id  INTEGER NOT NULL REFERENCES sindicato_fecha_mes(id) ON DELETE CASCADE,
  parceiro_id   INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('convite', 'lembrete')),
  -- qual texto saiu: loja que já tinha produto no evento ou não
  variante      VARCHAR(12) NOT NULL CHECK (variante IN ('com_produto', 'sem_produto')),
  whatsapp      VARCHAR(20) NOT NULL,
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha_mes_id, parceiro_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_fecha_mes_avisos_evento ON fecha_mes_avisos(fecha_mes_id, tipo);

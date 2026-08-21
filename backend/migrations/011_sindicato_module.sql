-- Módulo Sindicato (Renan, menor aprendiz): salário fixo + bônus mensal por faixa
-- de faturamento bruto do Sindicato. Junior lança o faturamento; Renan só visualiza.
-- Execute: node migrations/run.js

ALTER TABLE internal_collaborators DROP CONSTRAINT IF EXISTS internal_collaborators_role_check;
ALTER TABLE internal_collaborators ADD CONSTRAINT internal_collaborators_role_check
  CHECK (role IN ('manager_azul', 'comercial_full', 'sindicato_aprendiz'));

CREATE TABLE IF NOT EXISTS sindicato_faturamento (
  id                 SERIAL PRIMARY KEY,
  reference_month    VARCHAR(7) NOT NULL UNIQUE,
  faturamento_bruto  DECIMAL(15,2) NOT NULL,
  bonus_renan        DECIMAL(10,2) NOT NULL DEFAULT 0,
  status             VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'pago')),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sindicato_fat_month ON sindicato_faturamento(reference_month);

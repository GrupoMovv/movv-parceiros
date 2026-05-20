-- Colaboradores internos e comissões internas (Pabline, Fernando)
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS internal_collaborators (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(30)  NOT NULL CHECK (role IN ('manager_azul', 'comercial_full')),
  whatsapp      VARCHAR(25),
  pix_key       VARCHAR(255),
  base_salary   NUMERIC(10,2) DEFAULT 1621.00,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_commissions (
  id                        SERIAL PRIMARY KEY,
  collaborator_id           INTEGER NOT NULL REFERENCES internal_collaborators(id) ON DELETE CASCADE,
  month                     VARCHAR(7) NOT NULL,

  -- Azul (ambos os colaboradores)
  azul_revenue              NUMERIC(15,2) DEFAULT 0,
  azul_commission_pct       NUMERIC(6,4)  DEFAULT 0,
  azul_commission           NUMERIC(15,2) DEFAULT 0,

  -- Direta (Fernando apenas)
  direta_certificates_count INTEGER       DEFAULT 0,
  direta_via_accounting     NUMERIC(15,2) DEFAULT 0,
  direta_via_direct         NUMERIC(15,2) DEFAULT 0,
  direta_commission         NUMERIC(15,2) DEFAULT 0,

  -- Totais
  base_salary               NUMERIC(15,2) DEFAULT 0,
  total_amount              NUMERIC(15,2) DEFAULT 0,

  status                    VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at                   TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collaborator_id, month)
);

CREATE INDEX IF NOT EXISTS idx_internal_comm_collab ON internal_commissions(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_internal_comm_month  ON internal_commissions(month);
CREATE INDEX IF NOT EXISTS idx_internal_comm_status ON internal_commissions(status);

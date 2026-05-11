-- Movv Parceiros — Migration inicial
-- Execute: psql $DATABASE_URL -f migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Parceiros
CREATE TABLE IF NOT EXISTS partners (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30)  UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('accounting','employee')),
  whatsapp    VARCHAR(25),
  pix_key     VARCHAR(255),
  parent_id   INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  is_admin    BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Produtos
CREATE TABLE IF NOT EXISTS products (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  type               VARCHAR(50)  NOT NULL
                       CHECK (type IN ('credit','bpo','digital_certificate','account','insurance','other')),
  description        TEXT,
  commission_rate    NUMERIC(6,4) DEFAULT 0.0100,
  faixa              VARCHAR(20)  DEFAULT 'media'
                       CHECK (faixa IN ('alta','media','baixa','especial')),
  percentual_repasse NUMERIC(6,4) DEFAULT 0.0100,
  is_active          BOOLEAN DEFAULT TRUE
);

-- Colunas adicionadas — seguro para bancos já existentes
ALTER TABLE products ADD COLUMN IF NOT EXISTS faixa              VARCHAR(20)  DEFAULT 'media';
ALTER TABLE products ADD COLUMN IF NOT EXISTS percentual_repasse NUMERIC(6,4) DEFAULT 0.0100;

-- Indicações
CREATE TABLE IF NOT EXISTS referrals (
  id               SERIAL PRIMARY KEY,
  protocol         VARCHAR(50)  UNIQUE NOT NULL,
  partner_id       INTEGER NOT NULL REFERENCES partners(id),
  client_name      VARCHAR(255) NOT NULL,
  client_whatsapp  VARCHAR(25)  NOT NULL,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  status           VARCHAR(20)  DEFAULT 'pending'
                     CHECK (status IN ('pending','converted','expired','cancelled')),
  operated_value   NUMERIC(15,2),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_partner ON referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status  ON referrals(status);

-- Comissões
CREATE TABLE IF NOT EXISTS commissions (
  id               SERIAL PRIMARY KEY,
  referral_id      INTEGER NOT NULL REFERENCES referrals(id),
  partner_id       INTEGER NOT NULL REFERENCES partners(id),
  amount           NUMERIC(15,2) NOT NULL,
  type             VARCHAR(30)   NOT NULL
                     CHECK (type IN ('employee','accounting','accounting_full','bpo_first','bpo_recurring')),
  status           VARCHAR(20)   DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','paid')),
  reference_month  VARCHAR(7)    NOT NULL,  -- YYYY-MM
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_partner ON commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_commissions_month   ON commissions(reference_month);

-- Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id               SERIAL PRIMARY KEY,
  partner_id       INTEGER NOT NULL REFERENCES partners(id),
  amount           NUMERIC(15,2) NOT NULL,
  payment_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
  reference_month  VARCHAR(7)    NOT NULL,
  commission_ids   INTEGER[],
  pix_receipt      VARCHAR(255),
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

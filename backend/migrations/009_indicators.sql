CREATE TABLE IF NOT EXISTS indicators (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  email VARCHAR(200),
  whatsapp VARCHAR(20) NOT NULL,
  pix_key VARCHAR(200) NOT NULL,
  pix_key_type VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  approved_at TIMESTAMP,
  approved_by INTEGER,
  rejection_reason TEXT,
  must_change_password BOOLEAN DEFAULT false,
  total_indications INTEGER DEFAULT 0,
  total_commissions DECIMAL(10,2) DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  pending_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicator_referrals (
  id SERIAL PRIMARY KEY,
  indicator_id INTEGER REFERENCES indicators(id),
  client_name VARCHAR(200) NOT NULL,
  client_cpf VARCHAR(14) NOT NULL,
  client_whatsapp VARCHAR(20) NOT NULL,
  client_email VARCHAR(200),
  product_name VARCHAR(200),
  product_category VARCHAR(20),
  estimated_value DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  commission_value DECIMAL(10,2),
  commission_pct DECIMAL(5,4),
  expires_at TIMESTAMP,
  renewed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicator_payments (
  id SERIAL PRIMARY KEY,
  indicator_id INTEGER REFERENCES indicators(id),
  referral_ids INTEGER[],
  total_amount DECIMAL(10,2) NOT NULL,
  pix_key VARCHAR(200) NOT NULL,
  pix_key_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicators_cpf ON indicators(cpf);
CREATE INDEX IF NOT EXISTS idx_indicators_status ON indicators(status);
CREATE INDEX IF NOT EXISTS idx_indicator_referrals_client_cpf ON indicator_referrals(client_cpf);
CREATE INDEX IF NOT EXISTS idx_indicator_referrals_status ON indicator_referrals(status);
CREATE INDEX IF NOT EXISTS idx_indicator_referrals_indicator ON indicator_referrals(indicator_id);

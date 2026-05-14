-- Adiciona email opcional do cliente na tabela referrals
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);

-- Chave PIX e documento do MOVV Partner, antes do primeiro pagamento
-- (Junior, 15/10/2026).
--   pix_key_type  tipo da chave (mesmo nome e valores dos indicadores, mais
--                 cnpj); a chave em si continua em partners.pix_key (001).
--                 Quem preenche é o PRÓPRIO Partner, em "Meu perfil".
--   documento     CPF (11) ou CNPJ (14), só dígitos; tipo_parceiro (mei, pj
--                 ou autonomo) e razao_social: só a equipe (admin e
--                 financeiro) preenche.
-- Ninguém grava CPF, CNPJ ou chave completos em log ou em admin_acoes.
-- Só colunas novas e um índice, idempotente. Não mexe nos dados que já
-- existem (contabilidades e funcionários continuam como estão).
-- Execute: node migrations/run.js

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(12)
    CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  ADD COLUMN IF NOT EXISTS documento VARCHAR(14)
    CHECK (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  ADD COLUMN IF NOT EXISTS tipo_parceiro VARCHAR(10)
    CHECK (tipo_parceiro IN ('mei', 'pj', 'autonomo')),
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255),
  ADD COLUMN IF NOT EXISTS documento_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documento_atualizado_por VARCHAR(300);

-- o mesmo CPF/CNPJ não pode estar em dois MOVV Partners
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_documento_movv
  ON partners (documento) WHERE documento IS NOT NULL AND type = 'movv_partner';

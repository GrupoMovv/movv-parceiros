-- Suporte a importação do "Relatório de Recebimentos" bruto (linha por
-- pagamento) e desativação de empresas ausentes numa nova importação.
ALTER TABLE sindicato_empresas_contribuintes
  ADD COLUMN IF NOT EXISTS ultimo_mes_pagamento DATE,
  ADD COLUMN IF NOT EXISTS motivo_inativo TEXT;

ALTER TABLE sindicato_contribuintes_importacoes
  ADD COLUMN IF NOT EXISTS desativadas INT DEFAULT 0;

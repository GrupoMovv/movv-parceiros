-- Troca de plano sem cobrança em dobro (decisão 2026-09-21): quem cancela
-- e assina outro plano em até 24h aproveita os dias que ainda tinha pagos
-- (ou de trial) da assinatura cancelada. Upgrade proporcional de verdade
-- fica pra uma fase futura. Execute: node migrations/run.js
--
-- origem_credito_id: de qual assinatura cancelada veio o crédito
-- credito_ate:       até quando vão os dias já pagos (nunca passa do
--                    acesso_ate da assinatura de origem — trocar várias
--                    vezes não cria dia extra)
-- Cartão: vira free_trial da preapproval (plano novo já vale, 1ª cobrança
-- em credito_ate). PIX: o mês pago começa em credito_ate.

ALTER TABLE sindicato_assinaturas
  ADD COLUMN IF NOT EXISTS origem_credito_id INTEGER REFERENCES sindicato_assinaturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credito_ate       TIMESTAMPTZ;

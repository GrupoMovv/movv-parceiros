-- Primeiro acesso novo (/acesso): conta com senha em vez de CPF + data de
-- nascimento, e três tipos de conta na mesma tabela (a sessão do
-- Marketplace/Meu Painel já é por sindicato_associados.id):
--   seci           associado SECI (empresa/filiado em dia na Base SECI) — todos os antigos
--   cliente        "outros segmentos": usa o marketplace, sem benefício de associado
--   pendente_seci  empresa do comércio que pediu pra se associar, aguardando o Sindicato
-- senha_hash NULL = conta antiga que ainda não criou senha (entra por CPF +
-- nascimento e define a senha no primeiro acesso).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS senha_hash        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tipo_acesso       VARCHAR(20) NOT NULL DEFAULT 'seci'
                             CHECK (tipo_acesso IN ('seci', 'cliente', 'pendente_seci')),
  ADD COLUMN IF NOT EXISTS empresa_seci_id   INTEGER REFERENCES empresas_seci(id);

CREATE INDEX IF NOT EXISTS idx_sindicato_associados_tipo_acesso ON sindicato_associados(tipo_acesso);

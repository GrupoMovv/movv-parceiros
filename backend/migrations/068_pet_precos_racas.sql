-- Pet parte 2: tabela de preços por serviço/porte e raças especializadas
-- (opcional — sem nenhuma = "atende todas as raças"), pros filtros do
-- /marketplace/pet (bairro, serviço, porte, faixa de preço, raça).
-- Idempotente (o Build Command roda npm run migrate a cada deploy).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS pet_racas TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiros_pet_racas ON sindicato_parceiros USING GIN (pet_racas);

-- Um preço por (parceiro, serviço, porte). Códigos do catálogo fechado em
-- backend/src/config/pet.js. O painel regrava a tabela inteira do parceiro.
CREATE TABLE IF NOT EXISTS pet_precos (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  servico      VARCHAR(30) NOT NULL,
  porte        VARCHAR(20) NOT NULL,
  preco        DECIMAL(10,2) NOT NULL CHECK (preco > 0),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parceiro_id, servico, porte)
);
CREATE INDEX IF NOT EXISTS idx_pet_precos_busca ON pet_precos(servico, porte, preco);

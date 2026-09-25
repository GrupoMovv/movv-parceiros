-- Segmento 🐾 Pet Shop e Serviços (parte 1 de 5): o parceiro marca quais
-- serviços/produtos pet oferece e quais portes atende. Códigos do catálogo
-- fechado em backend/src/config/pet.js. Idempotente (o Build Command roda
-- npm run migrate a cada deploy).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS pet_servicos TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pet_portes   TEXT[] NOT NULL DEFAULT '{}';

-- Filtro do marketplace por serviço (parte 2) — "tem banho_tosa?" etc.
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiros_pet_servicos ON sindicato_parceiros USING GIN (pet_servicos);

-- Dados pet do cadastro do /vender até a aprovação (igual beer_dados, 061).
ALTER TABLE sindicato_parceiros_solicitacoes ADD COLUMN IF NOT EXISTS pet_dados JSONB;

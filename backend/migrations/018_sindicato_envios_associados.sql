-- Permite que sindicato_envios registre envio de benefícios pra um associado
-- (sindicato_associados), além de colaborador de empresa (sindicato_colaboradores),
-- reaproveitando o mesmo fluxo de envio/template já existente.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_envios ALTER COLUMN colaborador_id DROP NOT NULL;

ALTER TABLE sindicato_envios
  ADD COLUMN IF NOT EXISTS associado_id INTEGER REFERENCES sindicato_associados(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sindicato_envios_associado ON sindicato_envios(associado_id);

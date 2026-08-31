-- Foto própria do dependente na carteirinha digital (até agora só o
-- titular tinha foto_url; a carteirinha pública do dependente sempre
-- caía pra iniciais ou, por bug já corrigido, mostrava a foto do titular).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados_dependentes
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);

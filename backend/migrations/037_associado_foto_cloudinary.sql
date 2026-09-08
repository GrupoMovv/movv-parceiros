-- Foto de associado/dependente estava indo pro disco local do Render
-- (uploads/), que zera a cada deploy — a carteirinha "perdia" a foto.
-- foto_public_id guarda o public_id do Cloudinary pra permitir apagar a
-- foto antiga ao trocar (mesmo padrão já usado em parceiros/produtos).
ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS foto_public_id TEXT;

ALTER TABLE sindicato_associados_dependentes
  ADD COLUMN IF NOT EXISTS foto_public_id TEXT;

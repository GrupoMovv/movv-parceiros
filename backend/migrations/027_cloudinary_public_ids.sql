-- Migracao pro Cloudinary: logo_url ja existia (string simples), mas deletar
-- uma imagem no Cloudinary exige o public_id, nao a URL. fotos_estabelecimento
-- e fotos (produtos) continuam JSONB sem alteracao de schema - cada item do
-- array passa a ganhar um campo "publicId" a partir de agora (fotos antigas,
-- feitas com upload local, ficam sem esse campo e continuam servidas de
-- backend/uploads/ normalmente - ver comentario em parceiroPerfilController.js
-- e parceiroProdutosController.js sobre o fallback de delecao).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS logo_public_id VARCHAR(255);

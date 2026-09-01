-- Token de edicao do autocadastro publico: permite o colaborador voltar
-- depois (link enviado no WhatsApp) pra trocar foto/whatsapp/email e
-- gerenciar dependentes, sem precisar de login (unico "segredo" e o token
-- na URL, mesmo padrao ja usado no carteirinha_hash).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS edit_token VARCHAR(32) UNIQUE;

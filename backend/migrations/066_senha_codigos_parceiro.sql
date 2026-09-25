-- Parte 5.2 (login unificado): o código de "esqueci minha senha" por
-- WhatsApp também serve pro usuário de empresa parceira (WhatsApp pessoal
-- dele, em sindicato_parceiro_usuarios.whatsapp_pessoal). Cada código é de
-- UMA pessoa OU de UM usuário de empresa — nunca dos dois, nunca de nenhum.
-- Idempotente (o Build Command roda npm run migrate a cada deploy).
-- Execute: node migrations/run.js

ALTER TABLE senha_codigos ALTER COLUMN associado_id DROP NOT NULL;

ALTER TABLE senha_codigos
  ADD COLUMN IF NOT EXISTS parceiro_usuario_id INTEGER REFERENCES sindicato_parceiro_usuarios(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE senha_codigos ADD CONSTRAINT senha_codigos_um_dono
    CHECK ((associado_id IS NULL) <> (parceiro_usuario_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_senha_codigos_parceiro ON senha_codigos(parceiro_usuario_id, criado_em);

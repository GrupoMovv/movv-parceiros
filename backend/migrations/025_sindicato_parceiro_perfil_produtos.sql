-- Blocos 3 e 4 do Portal do Parceiro: campos de perfil editavel e de
-- produto que a migration 024 (Bloco 1) ainda nao previa.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS razao_social           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cnpj                   VARCHAR(18),
  ADD COLUMN IF NOT EXISTS descricao_completa     TEXT,
  ADD COLUMN IF NOT EXISTS categoria_principal    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS bairro                 VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cidade                 VARCHAR(120) NOT NULL DEFAULT 'Itumbiara',
  ADD COLUMN IF NOT EXISTS estado                 VARCHAR(2)  NOT NULL DEFAULT 'GO',
  ADD COLUMN IF NOT EXISTS telefone_fixo          VARCHAR(20),
  -- {"seg": {"aberto": true, "abre": "08:00", "fecha": "18:00"}, "ter": {...}, ...}
  ADD COLUMN IF NOT EXISTS horario_funcionamento  JSONB NOT NULL DEFAULT '{}',
  -- [{"url": "/uploads/parceiros/1/estabelecimento/xxx.jpg", "ordem": 1}, ...]
  ADD COLUMN IF NOT EXISTS fotos_estabelecimento  JSONB NOT NULL DEFAULT '[]';

ALTER TABLE sindicato_parceiro_produtos
  ADD COLUMN IF NOT EXISTS categoria           VARCHAR(60),
  ADD COLUMN IF NOT EXISTS marca               VARCHAR(120),
  -- [{"url": "/uploads/parceiros/1/produtos/5/xxx.jpg", "ordem": 1}, ...] - a de ordem 1 e a principal
  ADD COLUMN IF NOT EXISTS fotos               JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS preco_associado     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estoque_disponivel  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS destaque            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rascunho            BOOLEAN NOT NULL DEFAULT false;

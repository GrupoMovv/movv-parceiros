-- Conta com senha no IUB MAIS+ (/entrar e /criar-conta), no lugar do login
-- por CPF + data de nascimento. Tudo continua em sindicato_associados (a
-- sessão do Marketplace/Meu Painel já é por sindicato_associados.id), com
-- dois tipos de conta:
--   seci     associado SECI — todos os antigos, e quem entra com empresa em dia
--   cliente  consumidor comum: usa o marketplace, sem preço/benefício de associado
-- senha_hash NULL = associado antigo que ainda não fez o primeiro acesso
-- (confirma a data de nascimento e cria a senha em /entrar/primeiro-acesso).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS senha_hash          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS senha_definida_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tipo_acesso         VARCHAR(20) NOT NULL DEFAULT 'seci'
                             CHECK (tipo_acesso IN ('seci', 'cliente')),
  ADD COLUMN IF NOT EXISTS empresa_seci_id     INTEGER REFERENCES empresas_seci(id),
  -- bloqueio por senha errada (separado do bloqueio por data de nascimento)
  ADD COLUMN IF NOT EXISTS senha_tentativas    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS senha_bloqueada_ate TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sindicato_associados_tipo_acesso ON sindicato_associados(tipo_acesso);
-- login e recuperação de senha por WhatsApp procuram por aqui
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_whatsapp ON sindicato_associados(whatsapp);

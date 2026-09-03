-- Bloco Configuracoes do Portal do Parceiro: senha, notificacoes, dados da
-- conta, plano e zona de perigo (pausar/excluir).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiro_usuarios
  ADD COLUMN IF NOT EXISTS nome                      VARCHAR(160),
  ADD COLUMN IF NOT EXISTS whatsapp_pessoal           VARCHAR(20),
  -- troca de email so efetiva depois de confirmar no link mandado pro
  -- endereco NOVO - ate la o login continua pelo email antigo.
  ADD COLUMN IF NOT EXISTS email_pendente             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_pendente_token       VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_pendente_expira_em   TIMESTAMPTZ,
  -- rate limit de troca de senha - separado de tentativas_login (login
  -- errado e senha-atual errada no formulario de troca sao coisas diferentes).
  ADD COLUMN IF NOT EXISTS tentativas_senha           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_senha     TIMESTAMPTZ;

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS preferencias_notificacao   JSONB NOT NULL DEFAULT '{}',
  -- exclusao de conta e via link de confirmacao por email (mesmo padrao do
  -- reset de senha) que so "pega" depois de 24h da solicitacao - sem job
  -- agendado rodando: o proprio clique no link, tarde o suficiente, e quem
  -- efetiva a exclusao. Ver parceiroContaController.confirmarExclusao.
  ADD COLUMN IF NOT EXISTS exclusao_token             VARCHAR(64),
  ADD COLUMN IF NOT EXISTS exclusao_solicitada_em     TIMESTAMPTZ;

-- Log de auditoria simples ("quem mudou o que quando"). Sem FK pra
-- sindicato_parceiros de proposito: se a conta for excluida de verdade, o
-- log da propria exclusao nao pode sumir junto (cascade apagaria a prova).
CREATE TABLE IF NOT EXISTS sindicato_parceiro_auditoria (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL,
  usuario_id   INTEGER,
  acao         VARCHAR(60) NOT NULL,
  detalhes     JSONB,
  ip_origem    VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_auditoria_parceiro ON sindicato_parceiro_auditoria(parceiro_id, created_at);

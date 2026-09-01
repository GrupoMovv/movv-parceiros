-- Declaracao anti-fraude (consent_at/consent_ip) e rate-limit do "login"
-- publico por CPF + data de nascimento (tentativas_login_publico conta
-- falhas consecutivas dentro de uma janela de 15min; ultimo_login_publico
-- guarda o horario da ultima falha, usado tanto pra resetar a janela quanto
-- pra calcular o bloqueio de 30min — ver publicCadastroController.login).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS consent_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip                 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS tentativas_login_publico   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_login_publico       TIMESTAMPTZ;

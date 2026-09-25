-- Fluxos 2 e 3 do /acesso.
-- Fluxo 3 (outros segmentos, tipo_acesso 'cliente'): CPF é OPCIONAL — a
-- conta é identificada pelo WhatsApp. O UNIQUE de cpf continua valendo pra
-- quem informa (Postgres aceita vários NULL num UNIQUE).
-- Fluxo 2 (empresa do comércio quer se associar, 'pendente_seci'): a
-- solicitação que o Sindicato já vê em /sindicato/solicitacoes passa a
-- apontar pra conta criada, pra aprovar/recusar mexer nela junto.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados ALTER COLUMN cpf DROP NOT NULL;

ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS segmento VARCHAR(60);

-- Login e recuperação de senha por WhatsApp (parte 4) procuram por aqui.
CREATE INDEX IF NOT EXISTS idx_sindicato_associados_whatsapp ON sindicato_associados(whatsapp);

ALTER TABLE sindicato_solicitacoes_empresa
  ADD COLUMN IF NOT EXISTS associado_id    INTEGER REFERENCES sindicato_associados(id),
  ADD COLUMN IF NOT EXISTS cpf_responsavel VARCHAR(11),
  ADD COLUMN IF NOT EXISTS origem          VARCHAR(20) NOT NULL DEFAULT 'cadastrar';

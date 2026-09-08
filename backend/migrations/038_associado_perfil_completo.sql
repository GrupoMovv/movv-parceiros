-- Campos do formulario "Meus Dados" do Portal do Associado (auto-atendimento).
ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS receber_whatsapp BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receber_email BOOLEAN NOT NULL DEFAULT true;

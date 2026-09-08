-- CPF (opcional, unico entre dependentes ativos) + soft delete: remover um
-- dependente pelo Portal do Associado nao apaga a linha (mantem historico e
-- a integridade do slot de ordem), so marca inativo e desativa a carteirinha.
ALTER TABLE sindicato_associados_dependentes
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS removido_em TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dependentes_cpf_ativo
  ON sindicato_associados_dependentes (cpf) WHERE cpf IS NOT NULL AND ativo = true;

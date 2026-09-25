-- /criar-conta + carteirinha de 6 meses (parte 3).
--
-- legado: os associados que já existiam antes do /criar-conta (394 em
-- 25/09/2026) mantêm o benefício SEM depender de validade nem de empresa —
-- decisão do Junior. Todo associado novo segue a regra nova: carteirinha
-- de 6 meses + empresa vinculada em dia (ver beneficioAssociado.js).
-- ADD COLUMN com DEFAULT true marca como legado só quem já está na tabela
-- (run.js reexecuta a migration a cada deploy, mas o ADD só acontece uma
-- vez); o SET DEFAULT false vale pra todo cadastro dali em diante.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_associados ADD COLUMN IF NOT EXISTS legado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sindicato_associados ALTER COLUMN legado SET DEFAULT false;

-- Cadastro que informou CNPJ devendo / fora da Base SECI (ou CPF de
-- filiado devendo) avisa o Sindicato em /sindicato/solicitacoes.
ALTER TABLE sindicato_solicitacoes_empresa
  ADD COLUMN IF NOT EXISTS associado_id INTEGER REFERENCES sindicato_associados(id),
  ADD COLUMN IF NOT EXISTS origem       VARCHAR(20) NOT NULL DEFAULT 'cadastrar',
  ADD COLUMN IF NOT EXISTS motivo       VARCHAR(20)
                             CHECK (motivo IS NULL OR motivo IN ('pendencia', 'nao_encontrada'));

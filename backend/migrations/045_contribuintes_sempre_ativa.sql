-- Empresas do próprio grupo (ex.: Open Gestão Empresarial) não pagam guia
-- sindical mas precisam ficar liberadas pro autocadastro público mesmo
-- nunca aparecendo no relatório mensal de recebimentos — sempre_ativa
-- marca essa exceção e blinda a empresa da desativação automática em
-- desativarAusentes() (contribuintesImportService.js).
-- Execute: node migrations/run.js
ALTER TABLE sindicato_empresas_contribuintes
  ADD COLUMN IF NOT EXISTS sempre_ativa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacoes_ativacao TEXT;

-- Open Gestão Empresarial: empresa do grupo, não paga guia sindical,
-- mas fica liberada pro autocadastro mesmo sem aparecer no relatório.
UPDATE sindicato_empresas_contribuintes
  SET sempre_ativa = true,
      observacoes_ativacao = 'Empresa do grupo (Open Gestão Empresarial) — não paga guia sindical, liberada pro autocadastro.'
  WHERE cnpj = '61644671000180';

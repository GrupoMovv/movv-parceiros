-- Precificação diferenciada por sindicalização (empresa em dia em
-- sindicato_empresas_contribuintes paga menos, ver config/planos.js e
-- sindicalizacaoService). Guarda um "snapshot" do preço/tipo cobrado no
-- momento da troca de plano — se a empresa mudar de status depois (deixa de
-- estar em dia, por exemplo), o preço já cobrado não muda sozinho, só na
-- próxima troca/renovação (ver sindicatoPlanosController.alterarPlano).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS plano_preco_cobrado     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS plano_era_sindicalizada BOOLEAN;

ALTER TABLE sindicato_plano_historico
  ADD COLUMN IF NOT EXISTS preco_cobrado     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS era_sindicalizada BOOLEAN;

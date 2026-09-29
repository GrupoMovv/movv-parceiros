-- Empresa de teste NUNCA tem CNPJ (Junior, 29/09/2026). Dois incidentes
-- seguidos de CNPJ real em conta de teste: 28/09 uma escola, 29/09 uma adega
-- real (CNPJ digitado na Adega Teste pra passar na validação do Disk
-- Bebidas). Trava no banco: vale pra qualquer tela, inclusive as futuras
-- e a edição pelo admin. Empresa teste usa só CNAE.
UPDATE sindicato_parceiros SET cnpj = NULL WHERE empresa_teste AND cnpj IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_teste_sem_cnpj') THEN
    ALTER TABLE sindicato_parceiros
      ADD CONSTRAINT empresa_teste_sem_cnpj CHECK (NOT (empresa_teste AND cnpj IS NOT NULL AND cnpj <> ''));
  END IF;
END $$;

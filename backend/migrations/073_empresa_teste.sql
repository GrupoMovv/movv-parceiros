-- Empresa de teste (flag QA) — Junior, 29/09/2026. Solução definitiva pro
-- "caso da escola": parceiro de teste NUNCA aparece pra cliente em listagem
-- nenhuma (home, busca, categorias, vitrines, roleta, Pet, Disk Bebidas),
-- mesmo se alguém ativar. No Disk Bebidas o admin logado no mesmo navegador
-- vê (modo QA), inclusive pausado. Também dispensa CNPJ pra salvar CNAE no
-- painel Beer (a Adega Teste não tem CNPJ).
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS empresa_teste BOOLEAN NOT NULL DEFAULT false;

-- Adega Teste IUB (id 47) — confere o nome pra não marcar outro parceiro
UPDATE sindicato_parceiros SET empresa_teste = true
 WHERE id = 47 AND nome = 'Adega Teste IUB' AND empresa_teste = false;

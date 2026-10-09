-- O nome certo do convênio é "Drogaria Sindical" (Junior, 09/10/2026), não
-- "Nossa Drogaria". Corrige a tabela de convênios, a mensagem pronta de
-- benefícios do sindicato e a descrição da conta (pausada) da drogaria.
-- O histórico de mensagens já enviadas (sindicato_envios) fica como está.
-- Idempotente: cada UPDATE só pega o texto antigo.
UPDATE seci_convenios
SET nome = 'Drogaria Sindical'
WHERE slug = 'nossa-drogaria' AND nome = 'Nossa Drogaria';

UPDATE sindicato_mensagens_template
SET conteudo = replace(conteudo, '01. NOSSA DROGARIA', '01. DROGARIA SINDICAL'),
    updated_at = NOW()
WHERE conteudo LIKE '%01. NOSSA DROGARIA%';

UPDATE sindicato_parceiros
SET descricao_completa = replace(descricao_completa, 'A Nossa Drogaria', 'A Drogaria Sindical')
WHERE slug = 'nossa-drogaria' AND descricao_completa LIKE '%A Nossa Drogaria%';

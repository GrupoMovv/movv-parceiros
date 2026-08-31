-- Adiciona o link do catálogo em PDF ao fim da mensagem de benefícios do Sindicato.
-- Idempotente: só faz a alteração se o link ainda não estiver presente no conteúdo
-- (preserva qualquer edição manual já feita pelo admin no template).
--
-- run.js reexecuta TODAS as migrations a cada deploy (não há tabela de
-- controle de migrations aplicadas), então o guard de idempotência precisa
-- reconhecer o link independente da URL/host usados (a URL foi trocada na
-- migration 016). Checar pela URL exata quebrava esse guard e fazia o link
-- ser adicionado de novo a cada deploy -> mensagem chegava com o link
-- duplicado.
-- Execute: node migrations/run.js

UPDATE sindicato_mensagens_template
SET conteudo = conteudo || E'\n\n📄 Baixe o folder completo com todos os detalhes:\nhttps://portal.grupomovv.com.br/api/public/beneficios/catalogo.pdf',
    updated_at = NOW()
WHERE tipo = 'beneficios'
  AND conteudo NOT LIKE '%Baixe o folder completo com todos os detalhes%';

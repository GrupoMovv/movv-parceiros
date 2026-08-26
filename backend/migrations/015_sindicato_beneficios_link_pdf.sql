-- Adiciona o link do catálogo em PDF ao fim da mensagem de benefícios do Sindicato.
-- Idempotente: só faz a alteração se o link ainda não estiver presente no conteúdo
-- (preserva qualquer edição manual já feita pelo admin no template).
-- Execute: node migrations/run.js

UPDATE sindicato_mensagens_template
SET conteudo = conteudo || E'\n\n📄 Baixe o folder completo com todos os detalhes:\nhttps://portal.grupomovv.com.br/api/public/beneficios/catalogo.pdf',
    updated_at = NOW()
WHERE tipo = 'beneficios'
  AND conteudo NOT LIKE '%https://portal.grupomovv.com.br/api/public/beneficios/catalogo.pdf%';

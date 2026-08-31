-- Corrige o link do PDF no template de benefícios do Sindicato:
-- 1) troca o domínio pro backend direto (o Render Static Site não aplica
--    _redirects pra paths com extensão de arquivo reconhecida antes de
--    checar se o arquivo existe fisicamente, então o proxy pro backend
--    nunca era avaliado e o link no domínio próprio ficava 404);
-- 2) remove QUALQUER bloco de link já presente (de qualquer host) e
--    reinsere um único bloco no final.
--
-- (2) existe porque a migration 015 tinha um guard de idempotência preso
-- à URL antiga (portal.grupomovv.com.br); ao trocar de domínio aqui sem
-- atualizar aquele guard, a 015 parou de reconhecer o link já presente e
-- voltou a adicioná-lo a cada deploy (run.js reexecuta todas as migrations
-- sempre, não há tabela de controle) — resultado: link duplicado na
-- mensagem. O guard da 015 já foi corrigido, e este UPDATE aqui normaliza
-- o conteúdo que já ficou duplicado em produção.
--
-- Idempotente: pode rodar em todo deploy sem voltar a duplicar (remove
-- tudo e reinsere exatamente um bloco, sempre com o mesmo resultado).
-- Execute: node migrations/run.js

UPDATE sindicato_mensagens_template
SET conteudo = regexp_replace(
      conteudo,
      $pat$

📄 Baixe o folder completo com todos os detalhes:
https://[^\s]+catalogo\.pdf$pat$,
      '',
      'g'
    ) || $rep$

📄 Baixe o folder completo com todos os detalhes:
https://movv-backend.onrender.com/api/public/beneficios/catalogo.pdf$rep$,
    updated_at = NOW()
WHERE tipo = 'beneficios'
  AND conteudo LIKE '%Baixe o folder completo com todos os detalhes%';

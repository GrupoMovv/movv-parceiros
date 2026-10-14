-- Produto "Movv Certificado" para o MOVV Partner indicar Certificado
-- (Junior, 14/10/2026). Só dado: um produto do tipo digital_certificate,
-- que o CHECK de products já aceita desde a 001.
--
-- - Idempotente: só entra se ainda não houver NENHUM produto do tipo
--   digital_certificate (rodar de novo, ou depois de alguém cadastrar um
--   pelo admin, não duplica).
-- - commission_rate e percentual_repasse = 0: a comissão do Partner no
--   Certificado vem do livro (regra de 20% do lucro, migration 093) e só
--   nasce da venda registrada pelo Fernando — nunca deste produto.
-- - Fora da importação da Azul: o casamento só considera os tipos credit e
--   other (services/azulImportacao.js, TIPOS_PRODUTO_AZUL).
-- - Contabilidade e funcionário não veem nem indicam este tipo (elas vendem
--   Certificado pelo módulo Direta Certificação): ver productController e
--   referralController.
-- Execute: node migrations/run.js

INSERT INTO products (name, type, description, commission_rate, faixa, percentual_repasse, is_active)
SELECT 'Movv Certificado', 'digital_certificate',
       'Certificado digital (e-CPF e e-CNPJ) do Movv Certificado', 0, 'media', 0, true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE type = 'digital_certificate');

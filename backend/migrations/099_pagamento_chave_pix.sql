-- Chave PIX usada em cada pagamento (Junior, 19/10/2026). O Histórico de
-- Pagamentos mostrava a chave ATUAL do parceiro: um pagamento de 08/10
-- aparecia com a chave trocada em 09/10. Agora o pagamento guarda a chave
-- do cadastro no momento do registro.
--   pix_key_usada   chave copiada de partners.pix_key ao registrar o pagamento
--   pix_key_origem  'registro' = copiada na hora; os pagamentos antigos ficam
--                   NULL até o Junior decidir o que preencher (ver resumo de
--                   19/10: 'historico' ou 'suposicao' se ele aprovar).
-- Só colunas novas, idempotente. Não mexe nos pagamentos que já existem.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pix_key_usada  TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pix_key_origem VARCHAR(12)
  CHECK (pix_key_origem IN ('registro', 'historico', 'suposicao'));

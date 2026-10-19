-- Loja do Clube, parte b3 (Junior, 19/10/2026): preço Clube da loja no
-- pedido. Cada item guarda o preço que a pessoa pagaria sem o Clube (o
-- menor a que ela teria direito sem ser membro: normal, promoção, Fecha Mês
-- ou oferta) ao lado do preço pago (preco_unitario). O pedido guarda a taxa
-- de entrega que o Clube dispensou. Base do contador de economia (b5).
-- Pedidos antigos ficam com NULL / 0: não entram na economia.
ALTER TABLE loja_pedido_itens ADD COLUMN IF NOT EXISTS preco_sem_clube NUMERIC(10,2);
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS entrega_dispensada_clube NUMERIC(10,2) NOT NULL DEFAULT 0;

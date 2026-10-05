-- Pedido pelo site — número do pedido começa em 1001 (Junior, 05/10/2026).
-- Idempotente: o próximo id é sempre MAIOR que 1000 e maior que o maior
-- pedido que já existir (nunca volta a numeração).
SELECT setval(
  pg_get_serial_sequence('loja_pedidos', 'id'),
  GREATEST(1000, (SELECT COALESCE(MAX(id), 0) FROM loja_pedidos), (SELECT last_value FROM loja_pedidos_id_seq)),
  true
);

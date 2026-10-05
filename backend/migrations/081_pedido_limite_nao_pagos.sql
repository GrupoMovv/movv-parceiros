-- Pedido pelo site — ajuste do Junior (05/10/2026): o limite "1 pedido por
-- loja" conta só pedido AINDA NÃO PAGO (enviado/aceito). Depois de "pago,
-- saiu", o cliente pode fazer outro pedido na mesma loja.
-- Só troca um índice da tabela loja_pedidos (criada na 080). Idempotente.
DROP INDEX IF EXISTS uq_loja_pedidos_aberto_por_loja;
CREATE UNIQUE INDEX IF NOT EXISTS uq_loja_pedidos_nao_pago_por_loja ON loja_pedidos(associado_id, parceiro_id)
  WHERE status IN ('enviado', 'aceito');

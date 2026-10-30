-- Fecha Mês f5: o estoque do evento esgota (decisão do Junior, 20/10/2026).
-- estoque_disponivel continua sendo o que a loja informou; estoque_vendido
-- conta as unidades já pedidas ao preço do evento. O pedido reserva na
-- criação (atômico: com a última unidade, só um pedido passa) e devolve
-- quando é recusado, cancelado ou expira. Restante = disponível − vendido;
-- estoque_disponivel NULL = sem limite (o vendido só é contado).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_fecha_mes_produtos
  ADD COLUMN IF NOT EXISTS estoque_vendido INTEGER NOT NULL DEFAULT 0;

-- Segmento "bebidas" no cadastro do /vender: a solicitação já traz os dados
-- do IUB Disk Bebidas (tipo, horário, bairros, WhatsApp de pedidos e o
-- aceite do Termo). Ficam guardados aqui até o admin aprovar — aí viram a
-- linha de beer_estabelecimentos do parceiro novo, na mesma transação que
-- cria o parceiro (ver aprovarSolicitacao).
--
-- O segmento em si não precisa de migration: `segmento` é VARCHAR(30) sem
-- CHECK, a lista válida mora em parceiroSolicitacaoController.SEGMENTOS.
-- Não existe flag "iub_beer" no parceiro: estar no Beer = ter linha ativa
-- em beer_estabelecimentos (migration 058).
--
-- Execute: node migrations/run.js (aditivo e idempotente).
-- ROLLBACK (manual): ALTER TABLE sindicato_parceiros_solicitacoes DROP COLUMN IF EXISTS beer_dados;

-- {"tipo": "adega", "whatsapp": "64999998888", "horario_funcionamento": {...},
--  "bairros_entrega": ["Centro"], "termo_versao": "2026-09-23",
--  "termo_aceito_em": "2026-09-24T19:00:00.000Z", "termo_aceito_ip": "..."}
-- NULL em todo segmento que não é bebidas.
ALTER TABLE sindicato_parceiros_solicitacoes ADD COLUMN IF NOT EXISTS beer_dados JSONB;

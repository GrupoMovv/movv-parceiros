-- A2 (30/10/2026): segundo WhatsApp que recebe os avisos de pedido da loja
-- (pedido novo, lembrete do Pix...). Opcional. Vale para o catálogo geral e
-- para o Disk Bebidas. Cada aviso sai uma vez por número: destino 'loja2'.
ALTER TABLE sindicato_parceiros ADD COLUMN IF NOT EXISTS pedidos_whatsapp_extra VARCHAR(11);

ALTER TABLE loja_pedido_avisos DROP CONSTRAINT IF EXISTS loja_pedido_avisos_destino_check;
ALTER TABLE loja_pedido_avisos ADD CONSTRAINT loja_pedido_avisos_destino_check CHECK (destino IN ('cliente', 'loja', 'loja2', 'vendedor'));

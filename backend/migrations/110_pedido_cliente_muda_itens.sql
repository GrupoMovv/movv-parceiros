-- B1 (30/10/2026): o cliente muda os itens enquanto a loja não aceitou.
-- A mudança NÃO reinicia os 10 minutos da loja (created_at fica igual).
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS alterado_em TIMESTAMPTZ;
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS alteracoes INTEGER NOT NULL DEFAULT 0;

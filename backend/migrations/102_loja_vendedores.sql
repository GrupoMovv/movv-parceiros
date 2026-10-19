-- Equipe de vendas da loja (Junior, 19/10/2026). NÃO é o Vendedor Pessoa
-- Física (migration 076): aqui são os funcionários vendedores de uma loja
-- (CNPJ), sem login. Cada um tem um código curto e links da loja e dos
-- produtos com esse código; o pedido guarda quem trouxe o cliente e a loja vê
-- quanto cada um vendeu para pagar a comissão do jeito dela. O IUB MAIS+ não
-- paga comissão nem recebe dinheiro da venda.
--
-- O WhatsApp do vendedor é dado pessoal: só a loja vê. A loja declara que o
-- vendedor autorizou o cadastro (e o aviso de pedidos) — data, hora e quem
-- marcou ficam gravados. Desativar não apaga: o histórico e os pedidos
-- continuam ligados ao vendedor.
-- Idempotente (o run.js roda todas as migrations de novo a cada vez).

CREATE TABLE IF NOT EXISTS loja_vendedores (
  id               SERIAL PRIMARY KEY,
  parceiro_id      INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  nome             VARCHAR(80) NOT NULL,
  whatsapp         VARCHAR(20) NOT NULL,          -- DDD + número, sem o 55
  codigo           VARCHAR(8) NOT NULL UNIQUE,    -- 5 letras/números sem 0/O/1/I/L
  ativo            BOOLEAN NOT NULL DEFAULT true,
  avisar_whatsapp  BOOLEAN NOT NULL DEFAULT false, -- aviso ao vendedor quando entra pedido pelo link dele
  autorizou_em     TIMESTAMPTZ NOT NULL,           -- a loja marcou que o vendedor autorizou o uso do WhatsApp
  autorizou_por    VARCHAR(160),                   -- e-mail de quem marcou (usuário da loja)
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desativado_em    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_loja_vendedores_parceiro ON loja_vendedores (parceiro_id);

-- Pedido: o vendedor que trouxe o cliente (NULL = "loja", sem link).
ALTER TABLE loja_pedidos ADD COLUMN IF NOT EXISTS vendedor_id INTEGER REFERENCES loja_vendedores(id);
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_vendedor ON loja_pedidos (parceiro_id, vendedor_id);

-- Aviso ao vendedor quando entra pedido pelo link dele (e3): mais um destino
-- nos avisos do pedido (uma vez só por pedido, como os outros).
ALTER TABLE loja_pedido_avisos ALTER COLUMN destino TYPE VARCHAR(10);
ALTER TABLE loja_pedido_avisos DROP CONSTRAINT IF EXISTS loja_pedido_avisos_destino_check;
ALTER TABLE loja_pedido_avisos ADD CONSTRAINT loja_pedido_avisos_destino_check CHECK (destino IN ('cliente', 'loja', 'vendedor'));

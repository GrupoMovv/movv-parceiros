-- B2 (30/10/2026): "Esqueci um item" depois do aceite. O complemento é ligado
-- ao pedido, com itens próprios; o pedido original não muda. Só enquanto o
-- pedido está "aceito" (antes da loja confirmar o Pix): vai na mesma entrega,
-- sem nova taxa. A loja aceita ou recusa em 10 min; aceito, o cliente paga
-- só o valor do complemento e a loja confirma esse Pix à parte.
CREATE TABLE IF NOT EXISTS loja_pedido_complementos (
  id            SERIAL PRIMARY KEY,
  pedido_id     INTEGER NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  status        VARCHAR(12) NOT NULL CHECK (status IN ('enviado', 'aceito', 'pago', 'recusado', 'expirado', 'cancelado')),
  subtotal      NUMERIC(10,2) NOT NULL CHECK (subtotal > 0),
  total         NUMERIC(10,2) NOT NULL,
  resposta      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceito_em     TIMESTAMPTZ,
  pago_em       TIMESTAMPTZ,
  encerrado_em  TIMESTAMPTZ,
  encerrado_por VARCHAR(10),
  CONSTRAINT loja_pedido_complementos_total CHECK (total = subtotal)
);
CREATE INDEX IF NOT EXISTS idx_loja_pedido_complementos_pedido ON loja_pedido_complementos (pedido_id);
-- um complemento aberto por vez em cada pedido
CREATE UNIQUE INDEX IF NOT EXISTS uq_loja_pedido_complemento_aberto
  ON loja_pedido_complementos (pedido_id) WHERE status IN ('enviado', 'aceito');

CREATE TABLE IF NOT EXISTS loja_pedido_complemento_itens (
  id                   SERIAL PRIMARY KEY,
  complemento_id       INTEGER NOT NULL REFERENCES loja_pedido_complementos(id) ON DELETE CASCADE,
  origem               VARCHAR(12) NOT NULL,
  produto_id           INTEGER,
  promocao_id          INTEGER,
  fecha_mes_produto_id INTEGER,
  beer_produto_id      INTEGER,
  nome                 VARCHAR(200) NOT NULL,
  foto_url             TEXT,
  tipo_preco           VARCHAR(20) NOT NULL,
  preco_unitario       NUMERIC(10,2) NOT NULL,
  preco_cheio          NUMERIC(10,2),
  preco_sem_clube      NUMERIC(10,2),
  quantidade           INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal             NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loja_pedido_complemento_itens ON loja_pedido_complemento_itens (complemento_id);

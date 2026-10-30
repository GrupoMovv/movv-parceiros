-- A5 (30/10/2026): aparelhos da loja que recebem a notificação do navegador
-- (Web Push) de pedido novo, mesmo com o site minimizado. Um registro por
-- aparelho/navegador (endpoint). Sai sozinho quando o navegador diz que a
-- inscrição acabou (404/410).
CREATE TABLE IF NOT EXISTS loja_push_aparelhos (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  usuario_id   INTEGER,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  navegador    VARCHAR(200),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_envio_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_loja_push_aparelhos_parceiro ON loja_push_aparelhos (parceiro_id);

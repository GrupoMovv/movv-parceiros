-- Feature 1 (Pioneiro) + Feature 2 (Fecha Mês). Execute: node migrations/run.js

-- Selo vitalício pros primeiros 20 parceiros que virarem plano pago —
-- marcado automaticamente na troca de plano (ver sindicatoPlanosController),
-- nunca desmarcado depois (é "vitalício" mesmo se o parceiro trocar de
-- plano ou cancelar depois).
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS e_pioneiro BOOLEAN NOT NULL DEFAULT false;

-- Um "Fecha Mês" por data (última sexta do mês) — a linha é criada sob
-- demanda na primeira leitura (não por cron), `ativo=false` é como o admin
-- cancela/adia uma edição específica sem apagar o histórico dela.
CREATE TABLE IF NOT EXISTS sindicato_fecha_mes (
  id           SERIAL PRIMARY KEY,
  data_evento  DATE NOT NULL UNIQUE,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produtos confirmados por parceiro pra cada edição — preco_fecha_mes é
-- servido pro público (marketplace nunca sobrescreve produtos.preco de
-- verdade, então não existe "restaurar preço original" depois: a promoção
-- só existe enquanto essa linha está "no ar" pra data de hoje).
CREATE TABLE IF NOT EXISTS sindicato_fecha_mes_produtos (
  id                SERIAL PRIMARY KEY,
  fecha_mes_id      INTEGER NOT NULL REFERENCES sindicato_fecha_mes(id) ON DELETE CASCADE,
  produto_id        INTEGER NOT NULL REFERENCES sindicato_parceiro_produtos(id) ON DELETE CASCADE,
  parceiro_id       INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  preco_original    NUMERIC(10,2) NOT NULL,
  preco_fecha_mes   NUMERIC(10,2) NOT NULL,
  confirmado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha_mes_id, produto_id)
);
CREATE INDEX IF NOT EXISTS idx_fecha_mes_produtos_fecha_mes ON sindicato_fecha_mes_produtos(fecha_mes_id);
CREATE INDEX IF NOT EXISTS idx_fecha_mes_produtos_parceiro ON sindicato_fecha_mes_produtos(parceiro_id, fecha_mes_id);

-- Config chave/valor genérica — hoje só guarda o liga/desliga global do
-- Fecha Mês, mas serve pra qualquer flag simples futura sem precisar de
-- migration nova toda vez.
CREATE TABLE IF NOT EXISTS sindicato_config (
  chave        VARCHAR(60) PRIMARY KEY,
  valor        TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sindicato_config (chave, valor) VALUES ('fecha_mes_habilitado', 'true')
  ON CONFLICT (chave) DO NOTHING;

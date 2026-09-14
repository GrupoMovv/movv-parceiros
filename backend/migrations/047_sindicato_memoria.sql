-- IUB MAIS+ Joguinhos — Jogo da Memória. Sem cupom, sem premiação real,
-- só diversão ilimitada pra manter o associado no app quando a Roleta
-- não tem cupom novo pra dar (ver roletaController.getStatus).
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_memoria_partidas (
  id                  SERIAL PRIMARY KEY,
  associado_id        INTEGER NOT NULL REFERENCES sindicato_associados(id),
  tempo_segundos      INTEGER NOT NULL CHECK (tempo_segundos > 0),
  jogadas             INTEGER NOT NULL CHECK (jogadas > 0),
  data_partida         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ranking (top 10 do dia/semana) agrupa por associado_id filtrando por
-- data_partida — índice composto cobre os dois usos (ranking e "meu
-- recorde", que é só MIN(tempo_segundos) WHERE associado_id).
CREATE INDEX IF NOT EXISTS idx_memoria_partidas_associado ON sindicato_memoria_partidas(associado_id, tempo_segundos);
CREATE INDEX IF NOT EXISTS idx_memoria_partidas_data      ON sindicato_memoria_partidas(data_partida);

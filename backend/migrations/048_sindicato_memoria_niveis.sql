-- Niveis progressivos no Jogo da Memoria -- 5 niveis (4x4 a 6x6, ver
-- backend/src/config/memoriaNiveis.js), desbloqueio automatico ao
-- completar o nivel anterior.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_memoria_partidas
  ADD COLUMN IF NOT EXISTS nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS sindicato_memoria_niveis (
  associado_id   INTEGER NOT NULL REFERENCES sindicato_associados(id),
  nivel          INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 5),
  completado     BOOLEAN NOT NULL DEFAULT false,
  melhor_tempo   INTEGER,
  completado_em  TIMESTAMPTZ,
  PRIMARY KEY (associado_id, nivel)
);

-- Quem ja jogou antes desse nivel existir so tem partida em nivel=1 (o
-- DEFAULT acima) -- toda partida gravada ja e uma VITORIA (so se grava
-- partida completa, nunca tentativa perdida), entao qualquer associado
-- com >=1 partida ja completou o nivel 1 de verdade. Preserva o recorde
-- e a data da primeira partida como completado_em.
INSERT INTO sindicato_memoria_niveis (associado_id, nivel, completado, melhor_tempo, completado_em)
SELECT associado_id, 1, true, MIN(tempo_segundos), MIN(data_partida)
FROM sindicato_memoria_partidas
GROUP BY associado_id
ON CONFLICT (associado_id, nivel) DO NOTHING;

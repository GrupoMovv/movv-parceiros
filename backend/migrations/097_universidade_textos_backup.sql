-- Backup dos textos da Universidade antes de um lote de ajustes (Junior,
-- 15/10/2026). O script scripts/aplicarTextosUniversidade.js guarda aqui a
-- linha ORIGINAL inteira (tópico, aula, módulo ou pergunta do quiz) antes de
-- mudar — uma cópia por registro e por lote: rodar de novo não sobrescreve o
-- original. Tópico criado pelo lote fica registrado com dados =
-- {"criado_pelo_lote": true}, para o "desfazer" saber que deve apagá-lo.
-- Não guarda dado de Partner (só conteúdo da apostila).
-- Idempotente. Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS universidade_textos_backup (
  id          SERIAL PRIMARY KEY,
  lote        VARCHAR(60)  NOT NULL,
  tabela      VARCHAR(40)  NOT NULL
                CHECK (tabela IN ('universidade_topicos', 'universidade_aulas', 'universidade_modulos', 'universidade_quiz_perguntas')),
  registro_id INTEGER      NOT NULL,
  dados       JSONB        NOT NULL,
  salvo_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (lote, tabela, registro_id)
);

-- Universidade MOVV Partner (Junior, 09/10/2026): tópico editado ou criado
-- pelo admin fica marcado, e a reimportação do conteúdo (scripts/
-- importarUniversidade.js) pula esse tópico em vez de sobrescrever a correção.
ALTER TABLE universidade_topicos ADD COLUMN IF NOT EXISTS editado_manual_em  TIMESTAMPTZ;
ALTER TABLE universidade_topicos ADD COLUMN IF NOT EXISTS editado_manual_por VARCHAR(300);

-- Fecha Mês: editar/remover produtos confirmados até 3 dias antes do
-- evento, produtos BONUS exclusivos (não entram no catálogo normal, vivem
-- só dentro desta tabela — sem linha em sindicato_parceiro_produtos), e o
-- plano Grátis passa a poder participar (só com os 3 bônus).
-- Execute: node migrations/run.js

-- produto_id vira opcional: só é NOT NULL pra item de catálogo de verdade;
-- item bônus não referencia produto nenhum, tem seus próprios
-- nome/descrição/foto direto aqui (não polui sindicato_parceiro_produtos
-- nem precisa que toda listagem de produto do parceiro filtre bônus fora).
ALTER TABLE sindicato_fecha_mes_produtos
  ALTER COLUMN produto_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS e_produto_bonus     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_nome           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS bonus_descricao      TEXT,
  ADD COLUMN IF NOT EXISTS bonus_foto_url       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS bonus_foto_public_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS estoque_disponivel   INT,
  -- 'removido' é soft delete (Feature 1) — mantém a linha (e o histórico
  -- de cliques/relatórios que a referenciam) em vez de excluir de verdade.
  ADD COLUMN IF NOT EXISTS status               VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado','removido')),
  ADD COLUMN IF NOT EXISTS removido_em          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE sindicato_fecha_mes_produtos DROP CONSTRAINT IF EXISTS chk_fecha_mes_produtos_origem;
ALTER TABLE sindicato_fecha_mes_produtos
  ADD CONSTRAINT chk_fecha_mes_produtos_origem CHECK (
    (e_produto_bonus = false AND produto_id IS NOT NULL) OR
    (e_produto_bonus = true  AND bonus_nome IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_fecha_mes_produtos_status ON sindicato_fecha_mes_produtos(fecha_mes_id, parceiro_id, status);

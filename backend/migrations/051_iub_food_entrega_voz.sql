-- IUB Food fase 1: configuração de delivery/retirada do restaurante +
-- cadastro de produto por voz (Whisper -> GPT-4o, ver
-- openaiService.cadastrarProdutoPorVoz). Execute: node migrations/run.js
--
-- NÃO cria `horarios_funcionamento`: já existe `horario_funcionamento`
-- (migration 025) exatamente no formato que o IUB Food precisa —
-- {"seg": {"aberto": true, "abre": "18:00", "fecha": "23:00"}, ...} — e já
-- é editado em Meu Perfil. Uma segunda coluna com o mesmo dado ia
-- divergir na primeira vez que alguém editasse só uma das telas.
-- Pelo mesmo motivo, produto NÃO ganha `disponivel`: `estoque_disponivel`
-- (migration 025) já é o "disponível agora / indisponível" que o
-- marketplace mostra.

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS delivery_disponivel   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retirada_disponivel   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS taxa_entrega          NUMERIC(10,2),  -- NULL/0 = entrega grátis
  ADD COLUMN IF NOT EXISTS entrega_gratis_acima  NUMERIC(10,2),  -- pedido >= esse valor não paga taxa (NULL = nunca)
  ADD COLUMN IF NOT EXISTS raio_entrega_km       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tempo_preparo_min     INT;            -- "Pronto em ~30 min"

-- Override opcional por item (ex.: pizza leva mais que o refri). NULL =
-- usa o tempo_preparo_min do restaurante.
ALTER TABLE sindicato_parceiro_produtos
  ADD COLUMN IF NOT EXISTS tempo_preparo_min INT;

-- Uso da IA por voz entra na mesma sindicato_ia_uso com tipo
-- 'cadastro_voz' (a de foto é 'analise_produto'). Cota de voz é DIÁRIA
-- (config/planos.js max_voz_dia), por isso índice com data_uso.
CREATE INDEX IF NOT EXISTS idx_ia_uso_parceiro_tipo_data ON sindicato_ia_uso(parceiro_id, tipo, data_uso);

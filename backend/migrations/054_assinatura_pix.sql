-- Assinatura por PIX (fase B do Mercado Pago). Decisão: PIX paga NA HORA,
-- sem trial (trial de 7 dias só no cartão recorrente). Execute:
-- node migrations/run.js
--
-- 'aguardando_pagamento': assinatura PIX criada com QR gerado, primeiro
-- PIX ainda não pago. Vira 'ativa' no pagamento aprovado; se o PIX vencer
-- sem pagar, vira 'cancelada' (a rotina diária limpa as que sobrarem).

DO $$
DECLARE nome_check TEXT;
BEGIN
  SELECT conname INTO nome_check FROM pg_constraint
   WHERE conrelid = 'sindicato_assinaturas'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF nome_check IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sindicato_assinaturas DROP CONSTRAINT %I', nome_check);
  END IF;
  ALTER TABLE sindicato_assinaturas ADD CONSTRAINT sindicato_assinaturas_status_check
    CHECK (status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada', 'cancelada', 'vencida'));
END $$;

-- "No máximo uma assinatura viva por parceiro" passa a incluir a que está
-- aguardando o primeiro PIX (dois cliques em "Assinar" = uma só).
DROP INDEX IF EXISTS uq_assinatura_viva_por_parceiro;
CREATE UNIQUE INDEX uq_assinatura_viva_por_parceiro
  ON sindicato_assinaturas(parceiro_id) WHERE status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada');

-- Lembretes da rotina diária (PIX vencendo, trial acabando...): guarda o
-- último enviado pra não mandar o mesmo e-mail todo dia.
ALTER TABLE sindicato_assinaturas
  ADD COLUMN IF NOT EXISTS ultimo_lembrete_tipo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ultimo_lembrete_em   TIMESTAMPTZ;

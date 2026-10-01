-- Cobrança do Vendedor Pessoa Física (Junior, 01/10/2026): planos
-- pf_casual (R$ 19,90) e pf_empreendedor (R$ 34,90), preço único, pelo mesmo
-- fluxo do Mercado Pago das empresas (config/planos.js).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sindicato_assinaturas_plano_nome_check') THEN
    ALTER TABLE sindicato_assinaturas DROP CONSTRAINT sindicato_assinaturas_plano_nome_check;
  END IF;
  ALTER TABLE sindicato_assinaturas ADD CONSTRAINT sindicato_assinaturas_plano_nome_check
    CHECK (plano_nome IN ('oficial', 'premium', 'master', 'pf_casual', 'pf_empreendedor'));
END $$;

-- PF sem plano pago não aparece no site: status 'aguardando_plano' (as
-- listagens públicas exigem 'ativo'). Quem já foi aprovado e está 'ativo'
-- sem plano PF vigente passa pra 'aguardando_plano' (services/statusPf.js).
UPDATE sindicato_parceiros SET status = 'aguardando_plano', updated_at = NOW()
 WHERE tipo_pessoa = 'pf' AND status = 'ativo' AND NOT cortesia_interna
   AND NOT (plano IN ('pf_casual', 'pf_empreendedor') AND (plano_expira_em IS NULL OR plano_expira_em > NOW()));

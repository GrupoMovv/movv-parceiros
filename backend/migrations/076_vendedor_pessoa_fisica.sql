-- Vendedor Pessoa Física (CPF) no IUB MAIS+ — Junior, 30/09/2026.
-- Níveis: casual (CPF, venda ocasional), empreendedor (CPF ou MEI, vende
-- sempre), comercial (CNPJ — todo parceiro de hoje). Pessoa física nasce
-- com status 'em_verificacao': as listagens públicas já exigem 'ativo',
-- então ela não aparece em lugar nenhum até o admin aprovar a identidade.
-- Idempotente (o deploy roda todas as migrations de novo).

-- 1. Parceiro: tipo de pessoa, nível, CPF, identidade, aceite dos termos PF
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS tipo_pessoa     VARCHAR(2)  NOT NULL DEFAULT 'pj',
  ADD COLUMN IF NOT EXISTS nivel_vendedor  VARCHAR(12) NOT NULL DEFAULT 'comercial',
  ADD COLUMN IF NOT EXISTS e_mei           BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf             VARCHAR(11),
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  -- identidade (só PF): fotos ficam no Cloudinary como PRIVADAS; aqui só o
  -- public_id (nunca URL pública — ver LGPD art. 11, dado sensível)
  ADD COLUMN IF NOT EXISTS identidade_status          VARCHAR(12),
  ADD COLUMN IF NOT EXISTS identidade_doc_public_id   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS identidade_selfie_public_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS identidade_enviada_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identidade_revisada_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identidade_revisada_por    INTEGER,
  ADD COLUMN IF NOT EXISTS identidade_motivo          TEXT,
  -- aceite eletrônico dos Termos do Vendedor Pessoa Física
  ADD COLUMN IF NOT EXISTS termos_pf_versao           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS termos_pf_aceito_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termos_pf_aceito_ip        VARCHAR(64),
  ADD COLUMN IF NOT EXISTS termos_pf_user_agent       VARCHAR(500);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_tipo_pessoa_ok') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_tipo_pessoa_ok CHECK (tipo_pessoa IN ('pf', 'pj'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_nivel_ok') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_nivel_ok CHECK (nivel_vendedor IN ('casual', 'empreendedor', 'comercial'));
  END IF;
  -- PF: tem CPF, não tem CNPJ, não é "comercial". "cpf IS NOT NULL" explícito:
  -- num CHECK, NULL ~ '...' dá NULL e o Postgres deixaria passar PF sem CPF.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_pf_coerente') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_pf_coerente CHECK (
      tipo_pessoa <> 'pf' OR (cpf IS NOT NULL AND cpf ~ '^[0-9]{11}$' AND (cnpj IS NULL OR cnpj = '') AND nivel_vendedor IN ('casual', 'empreendedor') AND NOT e_mei)
    );
  END IF;
  -- PJ não guarda CPF de vendedor
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_pj_sem_cpf') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_pj_sem_cpf CHECK (tipo_pessoa <> 'pj' OR cpf IS NULL);
  END IF;
  -- mesma trava da 074, agora pro CPF: empresa de teste nunca guarda documento real
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_teste_sem_cpf') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT empresa_teste_sem_cpf CHECK (NOT (empresa_teste AND cpf IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_identidade_status_ok') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_identidade_status_ok CHECK (identidade_status IS NULL OR identidade_status IN ('pendente', 'aprovada', 'rejeitada'));
  END IF;
END $$;

-- um vendedor por CPF
CREATE UNIQUE INDEX IF NOT EXISTS idx_parceiros_cpf_unico ON sindicato_parceiros (cpf) WHERE cpf IS NOT NULL;
-- fila de identidade do admin
CREATE INDEX IF NOT EXISTS idx_parceiros_identidade_pendente ON sindicato_parceiros (identidade_enviada_em) WHERE identidade_status = 'pendente';

-- 2. Produto do catálogo comum: moderação (hoje só o Disk Bebidas tem).
-- Todo produto que já existe e de CNPJ nasce 'aprovado'; produto de CPF
-- nasce 'pendente' (o código decide) e só aparece depois de aprovado.
ALTER TABLE sindicato_parceiro_produtos
  ADD COLUMN IF NOT EXISTS moderacao_status   VARCHAR(10) NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS moderacao_motivo   TEXT,
  ADD COLUMN IF NOT EXISTS moderacao_checks   JSONB,
  ADD COLUMN IF NOT EXISTS moderado_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderado_por       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produto_moderacao_status_ok') THEN
    ALTER TABLE sindicato_parceiro_produtos ADD CONSTRAINT produto_moderacao_status_ok
      CHECK (moderacao_status IN ('aprovado', 'pendente', 'rejeitado', 'suspenso'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_produtos_moderacao_pendente ON sindicato_parceiro_produtos (created_at) WHERE moderacao_status = 'pendente';

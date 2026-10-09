-- Universidade MOVV Partner (Junior, 09/10/2026): apostila por módulo, progresso,
-- quiz, aceite do termo de adesão e certificado. O Partner entra pelo login do
-- portal (partners.type = 'movv_partner', código PARTNER-NNN). Prefixo
-- universidade_. O conteúdo entra por scripts/importarUniversidade.js, tudo
-- despublicado; o Módulo 7 (CRM) fica despublicado até ter conteúdo.

-- 1. Partner no portal
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_type_check;
ALTER TABLE partners ADD CONSTRAINT partners_type_check
  CHECK (type IN ('accounting','employee','movv_partner'));
ALTER TABLE partners ADD COLUMN IF NOT EXISTS nivel_partner VARCHAR(20)
  CHECK (nivel_partner IN ('mobile','point','hub','regional'));

-- 2. Conteúdo
CREATE TABLE IF NOT EXISTS universidade_modulos (
  id                   SERIAL PRIMARY KEY,
  numero               INTEGER      NOT NULL UNIQUE,
  titulo               VARCHAR(300) NOT NULL,
  descricao            TEXT,
  icone                VARCHAR(40),
  ordem                INTEGER      NOT NULL,
  publicado            BOOLEAN      NOT NULL DEFAULT false,
  publicado_em         TIMESTAMPTZ,                          -- 1ª publicação: prazo de 30 dias para quem já é certificado
  conteudo_pendente    BOOLEAN      NOT NULL DEFAULT false,  -- Módulo 7
  exige_recertificacao BOOLEAN      NOT NULL DEFAULT false,  -- última edição foi "mudança relevante"
  versao_conteudo      INTEGER      NOT NULL DEFAULT 1,
  recertificar_desde   TIMESTAMPTZ,                          -- só tentativas depois disso aprovam o módulo
  atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS universidade_aulas (
  id            SERIAL PRIMARY KEY,
  modulo_id     INTEGER      NOT NULL REFERENCES universidade_modulos(id) ON DELETE CASCADE,
  ordem         INTEGER      NOT NULL,
  titulo        VARCHAR(300) NOT NULL,
  video_url     TEXT,                                        -- opcional, sem tela de upload por enquanto
  publicado     BOOLEAN      NOT NULL DEFAULT true,          -- quem publica é o módulo
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (modulo_id, ordem)
);

CREATE TABLE IF NOT EXISTS universidade_topicos (
  id            SERIAL PRIMARY KEY,
  aula_id       INTEGER      NOT NULL REFERENCES universidade_aulas(id) ON DELETE CASCADE,
  numero        INTEGER      NOT NULL,
  titulo        VARCHAR(500) NOT NULL,
  texto         TEXT         NOT NULL,
  ordem         INTEGER      NOT NULL,
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (aula_id, numero)
);

-- 3. Progresso do Partner (user_id = partners.id)
CREATE TABLE IF NOT EXISTS universidade_progresso (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER     NOT NULL REFERENCES partners(id),
  aula_id  INTEGER     NOT NULL REFERENCES universidade_aulas(id) ON DELETE CASCADE,
  lida_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, aula_id)
);

-- 4. Quiz
CREATE TABLE IF NOT EXISTS universidade_quiz_perguntas (
  id           SERIAL PRIMARY KEY,
  modulo_id    INTEGER     NOT NULL REFERENCES universidade_modulos(id) ON DELETE CASCADE,
  numero       INTEGER     NOT NULL,
  enunciado    TEXT        NOT NULL,
  alternativas JSONB       NOT NULL,   -- [{"id":"k7q2xp","texto":"..."}], id aleatório e fixo
  correta      VARCHAR(12) NOT NULL,   -- id da alternativa certa (nunca a letra)
  explicacao   TEXT,
  ativa        BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (modulo_id, numero)
);

CREATE TABLE IF NOT EXISTS universidade_quiz_tentativas (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER      NOT NULL REFERENCES partners(id),
  modulo_id       INTEGER      NOT NULL REFERENCES universidade_modulos(id) ON DELETE CASCADE,
  versao_conteudo INTEGER      NOT NULL,
  acertos         INTEGER      NOT NULL,
  total           INTEGER      NOT NULL,
  nota            NUMERIC(5,4) NOT NULL,
  aprovado        BOOLEAN      NOT NULL,
  respostas       JSONB        NOT NULL,   -- {pergunta_id: alternativa_id}
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_univ_tentativas_user ON universidade_quiz_tentativas (user_id, modulo_id, criado_em DESC);

-- 5. Termo de adesão e aceites
CREATE TABLE IF NOT EXISTS universidade_documentos (
  id           SERIAL PRIMARY KEY,
  documento    VARCHAR(60)  NOT NULL,      -- 'termo_adesao'
  versao       INTEGER      NOT NULL,
  titulo       VARCHAR(300) NOT NULL,
  texto        TEXT         NOT NULL,
  publicado    BOOLEAN      NOT NULL DEFAULT false,  -- só depois da revisão do advogado
  publicado_em TIMESTAMPTZ,
  UNIQUE (documento, versao)
);

CREATE TABLE IF NOT EXISTS universidade_aceites (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES partners(id),
  documento  VARCHAR(60) NOT NULL,
  versao     INTEGER     NOT NULL,
  aceito_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip         VARCHAR(64),
  user_agent TEXT,
  UNIQUE (user_id, documento, versao)
);

-- 6. Certificados
CREATE TABLE IF NOT EXISTS universidade_certificacoes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES partners(id),
  codigo     VARCHAR(20) NOT NULL UNIQUE,  -- MOVV-XXXXXX-AAAA
  nivel      VARCHAR(20),
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valido_ate TIMESTAMPTZ NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'valida'
             CHECK (status IN ('valida','vencida','revogada'))
);
CREATE INDEX IF NOT EXISTS idx_univ_cert_user ON universidade_certificacoes (user_id, emitido_em DESC);

-- 7. Liga/desliga e valores configuráveis
CREATE TABLE IF NOT EXISTS universidade_config (
  chave         VARCHAR(60) PRIMARY KEY,
  valor         TEXT        NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO universidade_config (chave, valor) VALUES
  ('nota_minima',             '0.70'),
  ('validade_meses',          '12'),
  ('prazo_atualizacao_dias',  '30'),
  ('trava_portal',            'false')
ON CONFLICT (chave) DO NOTHING;

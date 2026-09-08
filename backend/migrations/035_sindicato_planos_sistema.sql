-- Sistema completo de planos pagos (Fase 2, ainda DESLIGADA): prepara banco
-- e biblioteca de conteudo Master pra quando decidirmos ativar cobranca.
-- A coluna `plano` ja existe desde a migration 030 (default 'gratis') — so
-- completa aqui com o resto do ciclo de vida do plano (vigencia, status,
-- observacoes do admin) e os campos exclusivos de plano pago (banner
-- personalizado do Master, @ do Instagram de Premium/Master).
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS plano_ativo_desde          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS plano_expira_em             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano_status                VARCHAR(20) NOT NULL DEFAULT 'ativo'
    CHECK (plano_status IN ('ativo', 'cancelado', 'suspenso')),
  ADD COLUMN IF NOT EXISTS banner_personalizado_url    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS banner_personalizado_public_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_username          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS observacoes_plano           TEXT;

-- Todo mundo comeca e continua 'ativo' — so existe pra suportar suspensao
-- manual (ex: inadimplencia) sem precisar derrubar o parceiro inteiro.

-- Historico de toda troca de plano — motivo obrigatorio no controller (nao
-- aqui, pra mensagem de erro melhor), "sistema" como alterado_por quando for
-- expiracao automatica futura (ver 12: templates de email, ainda nao ativos).
CREATE TABLE IF NOT EXISTS sindicato_plano_historico (
  id              SERIAL PRIMARY KEY,
  parceiro_id     INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  plano_anterior  VARCHAR(20) NOT NULL,
  plano_novo      VARCHAR(20) NOT NULL,
  motivo          VARCHAR(30) NOT NULL CHECK (motivo IN ('upgrade', 'downgrade', 'cancelamento', 'ativacao_seed', 'suspensao', 'reativacao')),
  observacoes     TEXT,
  alterado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_por    VARCHAR(150) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sindicato_plano_historico_parceiro ON sindicato_plano_historico(parceiro_id, alterado_em DESC);

-- Biblioteca "Lives Exclusivas" (aba do painel, só visível pro plano Master)
-- — cadastro é manual via admin, o vídeo em si mora no Youtube/Vimeo (só
-- guardamos o link, unlisted).
CREATE TABLE IF NOT EXISTS sindicato_lives_master (
  id                SERIAL PRIMARY KEY,
  titulo            VARCHAR(200) NOT NULL,
  descricao         TEXT,
  video_url         VARCHAR(500) NOT NULL,
  data_gravacao     DATE,
  duracao_minutos   INTEGER,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_lives_master_ativo ON sindicato_lives_master(ativo, data_gravacao DESC);

-- Biblioteca "Materiais Exclusivos" (aba do painel, só Master) — PDFs,
-- templates e vídeos curtos educativos, por categoria.
CREATE TABLE IF NOT EXISTS sindicato_materiais_master (
  id              SERIAL PRIMARY KEY,
  titulo          VARCHAR(200) NOT NULL,
  descricao       TEXT,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('video', 'pdf', 'template', 'ebook')),
  url_conteudo    VARCHAR(500) NOT NULL,
  public_id       VARCHAR(255),
  categoria       VARCHAR(30) NOT NULL CHECK (categoria IN ('marketing', 'fotografia', 'gestao', 'precos')),
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_materiais_master_ativo ON sindicato_materiais_master(ativo, categoria);

-- Origem do acesso (direto/busca/categoria/vitrine...) pro analytics
-- detalhado dos planos pagos — infraestrutura preparada, front ainda não
-- manda esse dado em todo clique/visita (fica NULL = "não classificado"
-- até isso ser instrumentado ponta a ponta).
ALTER TABLE sindicato_parceiro_cliques
  ADD COLUMN IF NOT EXISTS origem VARCHAR(30);

-- Bloco 1 do Portal do Parceiro IUB MAIS: schema pros 9 parceiros que hoje
-- só existem hardcoded em frontend/.../Marketplace/parceirosData.js (Fase 1),
-- mais login (sindicato_parceiro_usuarios), produtos e promocoes (Bloco 3,
-- tabelas ja criadas vazias) e cliques (base pro dashboard de estatisticas).
-- Nao confundir com a tabela "partners" (existente) - aquela e do programa
-- de indicacao/comissao ("Indique e Ganhe"), dominio totalmente diferente.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_parceiros (
  id               SERIAL PRIMARY KEY,
  slug             VARCHAR(120) NOT NULL UNIQUE,
  nome             VARCHAR(160) NOT NULL,
  categorias       TEXT[] NOT NULL DEFAULT '{}',
  icone            VARCHAR(16),
  cor_icone        VARCHAR(7),
  logo_url         VARCHAR(255),
  descricao        TEXT,
  beneficio        TEXT,
  whatsapp         VARCHAR(20),
  endereco         VARCHAR(255),
  instagram        VARCHAR(255),
  google_maps_url  VARCHAR(500),
  exclusivo        BOOLEAN NOT NULL DEFAULT false,
  novo             BOOLEAN NOT NULL DEFAULT false,
  status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiros_status ON sindicato_parceiros(status);

-- Login do parceiro. Um parceiro pode ter mais de um usuario (cargo distingue
-- dono/gerente no futuro); senha sempre em hash (bcrypt), nunca texto plano.
CREATE TABLE IF NOT EXISTS sindicato_parceiro_usuarios (
  id                     SERIAL PRIMARY KEY,
  parceiro_id            INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  email                  VARCHAR(255) NOT NULL UNIQUE,
  senha_hash             VARCHAR(255) NOT NULL,
  cargo                  VARCHAR(40) NOT NULL DEFAULT 'dono',
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  ultimo_login           TIMESTAMPTZ,
  -- rate limit do /login, mesmo padrao ja usado em sindicato_associados
  -- (tentativas_login_publico / ultimo_login_publico) — ver publicCadastroController.
  tentativas_login       INTEGER NOT NULL DEFAULT 0,
  ultima_tentativa_em    TIMESTAMPTZ,
  reset_token            VARCHAR(64),
  reset_token_expira_em  TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_usuarios_parceiro ON sindicato_parceiro_usuarios(parceiro_id);

-- Bloco 3 (ainda nao construido) — tabelas ja criadas agora, vazias, pra nao
-- precisar de outra migration quando chegar a vez.
CREATE TABLE IF NOT EXISTS sindicato_parceiro_produtos (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  nome         VARCHAR(160) NOT NULL,
  descricao    TEXT,
  preco        NUMERIC(10,2),
  foto_url     VARCHAR(255),
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_produtos_parceiro ON sindicato_parceiro_produtos(parceiro_id);

CREATE TABLE IF NOT EXISTS sindicato_parceiro_promocoes (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  titulo       VARCHAR(160) NOT NULL,
  descricao    TEXT,
  valido_ate   DATE,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_promocoes_parceiro ON sindicato_parceiro_promocoes(parceiro_id);

-- Base do dashboard de estatisticas ("Visitas ao meu perfil", "Cliques no
-- WhatsApp"). Ninguem grava aqui ainda — o marketplace publico nao emite
-- esses eventos, entao os cards do dashboard mostram 0 honestamente ate
-- essa integracao ser feita (fora do escopo deste bloco).
CREATE TABLE IF NOT EXISTS sindicato_parceiro_cliques (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  tipo         VARCHAR(30) NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sindicato_parceiro_cliques_parceiro_tipo ON sindicato_parceiro_cliques(parceiro_id, tipo, criado_em);

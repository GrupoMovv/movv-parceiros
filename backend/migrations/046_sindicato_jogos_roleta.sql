-- IUB MAIS+ Joguinhos — Fase 1: Roleta da Sorte. Associado gira 1x/dia,
-- sempre ganha um cupom de desconto com um parceiro sorteado (ponderado
-- por plano do parceiro). Ver roletaService.js pra regra de sorteio.
-- Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_cupons_roleta (
  id                  SERIAL PRIMARY KEY,
  associado_id        INTEGER NOT NULL REFERENCES sindicato_associados(id),
  parceiro_id         INTEGER NOT NULL REFERENCES sindicato_parceiros(id),
  codigo_cupom        VARCHAR(20) UNIQUE NOT NULL,
  -- 100 representa o prêmio "DIAMANTE" (produto grátis / 100% off), não é
  -- um desconto percentual real cobrado do parceiro na integração de caixa.
  desconto_percentual INTEGER NOT NULL CHECK (desconto_percentual > 0 AND desconto_percentual <= 100),
  status              VARCHAR(20) NOT NULL DEFAULT 'ativo'
                         CHECK (status IN ('ativo', 'usado', 'expirado')),
  jogo_tipo           VARCHAR(20) NOT NULL DEFAULT 'roleta',
  jogado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valido_ate          TIMESTAMPTZ NOT NULL,
  usado_em            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cupons_roleta_associado ON sindicato_cupons_roleta(associado_id, jogo_tipo, jogado_em);
CREATE INDEX IF NOT EXISTS idx_cupons_roleta_parceiro   ON sindicato_cupons_roleta(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_cupons_roleta_status     ON sindicato_cupons_roleta(status);

-- Configuração de participação por parceiro — um parceiro pode ter no
-- máximo uma linha por jogo_tipo (hoje só 'roleta' existe; Tigrinho do Bem
-- e Raspadinha vêm em fases futuras, reusando essa mesma tabela).
CREATE TABLE IF NOT EXISTS sindicato_jogos_parceiros (
  id                  SERIAL PRIMARY KEY,
  parceiro_id         INTEGER NOT NULL REFERENCES sindicato_parceiros(id),
  jogo_tipo           VARCHAR(20) NOT NULL DEFAULT 'roleta',
  ativo               BOOLEAN NOT NULL DEFAULT true,
  desconto_percentual INTEGER NOT NULL DEFAULT 10 CHECK (desconto_percentual > 0 AND desconto_percentual <= 100),
  cupons_dia          INTEGER NOT NULL DEFAULT 5 CHECK (cupons_dia > 0),
  validade_dias       INTEGER NOT NULL DEFAULT 7 CHECK (validade_dias > 0),
  -- Peso no sorteio ponderado — setado a partir do plano do parceiro
  -- quando ele ativa o jogo (gratis não pode ativar, oficial=1, premium=3,
  -- master=5, ver PESO_POR_PLANO em roletaService.js), mas fica gravável
  -- aqui pra permitir ajuste manual futuro sem precisar mudar plano.
  peso_sorteio        INTEGER NOT NULL DEFAULT 1 CHECK (peso_sorteio >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parceiro_id, jogo_tipo)
);

CREATE INDEX IF NOT EXISTS idx_jogos_parceiros_ativo ON sindicato_jogos_parceiros(jogo_tipo, ativo);

-- Sequência de dias jogados seguidos — hoje só é gravada (não concede
-- bônus ainda; tentativas_bonus fica reservado pra uma fase futura de
-- "jogou 7 dias seguidos, ganha giro extra").
CREATE TABLE IF NOT EXISTS sindicato_jogos_streak (
  associado_id      INTEGER PRIMARY KEY REFERENCES sindicato_associados(id),
  dias_seguidos     INTEGER NOT NULL DEFAULT 0,
  ultimo_jogo       TIMESTAMPTZ,
  tentativas_bonus  INTEGER NOT NULL DEFAULT 0
);

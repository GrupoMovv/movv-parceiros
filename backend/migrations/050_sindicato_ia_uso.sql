-- IA Assistente de cadastro de produtos: parceiro sobe foto, IA (OpenAI
-- GPT-4o) sugere nome/descrição/marca/categoria/tags -- ver
-- backend/src/services/openaiService.js e
-- backend/src/controllers/parceiroIaController.js. Execute: node migrations/run.js

CREATE TABLE IF NOT EXISTS sindicato_ia_uso (
  id SERIAL PRIMARY KEY,
  parceiro_id INT NOT NULL REFERENCES sindicato_parceiros(id),
  tipo VARCHAR(50) NOT NULL DEFAULT 'analise_produto',
  imagem_url TEXT, -- reservado pra uma eventual cache por imagem (não populado nesta rodada -- ver TODO.md)
  resposta_json JSONB,
  data_uso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mes_referencia VARCHAR(7) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
);

-- Consulta de cota mensal (parceiroIaController.checarLimite): conta linhas
-- do parceiro no mes_referencia atual.
CREATE INDEX IF NOT EXISTS idx_ia_uso_parceiro_mes ON sindicato_ia_uso(parceiro_id, mes_referencia);
-- Consulta de rate limit (5 chamadas/min): conta linhas do parceiro no
-- último minuto por data_uso.
CREATE INDEX IF NOT EXISTS idx_ia_uso_parceiro_data ON sindicato_ia_uso(parceiro_id, data_uso);

-- Corrige quem rodou esta migration antes do ajuste de tipo abaixo
-- (CREATE TABLE IF NOT EXISTS não re-executa em quem já tem a tabela).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sindicato_ia_uso' AND column_name = 'data_uso' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE sindicato_ia_uso ALTER COLUMN data_uso TYPE TIMESTAMPTZ USING data_uso AT TIME ZONE 'UTC';
  END IF;
END $$;

-- Marca quando o plano atual começou a valer -- usado só pro trial de IA
-- ilimitada nos primeiros 3 dias (parceiroIaController.infoTrial). Em
-- quem já existe, DEFAULT NOW() dá um trial de 3 dias a partir do dia
-- desta migration (aceitável: é o lançamento da feature). De aqui pra
-- frente, todo parceiro novo já nasce com essa coluna preenchida pelo
-- próprio INSERT (DEFAULT se aplica mesmo sem citar a coluna) -- ver
-- parceiroSolicitacaoController.aprovarSolicitacao.
--
-- TIMESTAMPTZ de propósito, não TIMESTAMP puro (mesmo padrão de
-- reset_token_expira_em/exclusao_solicitada_em etc.): esta coluna faz
-- conta de "quantos dias se passaram" em JS (Date.now() - valor), e o
-- driver node-postgres lê "timestamp without time zone" interpretando os
-- componentes como hora LOCAL DO PROCESSO NODE, não UTC -- num servidor
-- cujo TZ não seja UTC isso desalinha o cálculo (verificado: gerava
-- "trial_dias_restantes": 4 em vez de 3 com TZ=America/Sao_Paulo local).
-- TIMESTAMPTZ não tem essa ambiguidade. O DO block abaixo corrige quem já
-- rodou esta migration com o tipo errado antes desse ajuste.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sindicato_parceiros' AND column_name = 'plano_iniciado_em' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE sindicato_parceiros ALTER COLUMN plano_iniciado_em TYPE TIMESTAMPTZ USING plano_iniciado_em AT TIME ZONE 'UTC';
  END IF;
END $$;

ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS plano_iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

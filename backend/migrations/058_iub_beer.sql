-- IUB BEER (bebidas +18) — mesmo modelo do IUB Food: estabelecimento é um
-- parceiro normal (sindicato_parceiros) com "Bebidas" no categorias[], e o
-- cardápio é o catálogo que já existe (sindicato_parceiro_produtos). Plano,
-- assinatura MP, login, painel e descontos SECI são os do parceiro — NÃO
-- existe plano_beer separado (um bar que também é restaurante aparece no
-- Food e no Beer com UMA assinatura). Execute: node migrations/run.js
--
-- Tudo aditivo e idempotente (run.js reroda todos os arquivos toda vez).
-- ROLLBACK (manual — run.js não tem "down"; rodar só se for desfazer o Beer):
--   DROP TABLE IF EXISTS beer_verificacoes_idade;
--   DROP INDEX IF EXISTS idx_parceiro_produtos_beer_categoria;
--   ALTER TABLE sindicato_parceiro_produtos DROP COLUMN IF EXISTS beer_categoria;
--   ALTER TABLE sindicato_parceiros DROP COLUMN IF EXISTS bairros_entrega;
--   ALTER TABLE sindicato_parceiros DROP COLUMN IF EXISTS beer_tipo;

-- 'adega' | 'distribuidora' | 'bar' | 'conveniencia' | 'emporio' — validado
-- no app (config/beer.js), sem CHECK aqui pelo mesmo motivo da migration
-- 049: travar no banco arrisca quebrar import/tipo novo no futuro. NULL =
-- ainda não informado (o parceiro aparece no /beer do mesmo jeito).
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS beer_tipo VARCHAR(50);

-- Bairros onde o estabelecimento entrega. Não existia no IUB Food (lá é
-- raio_entrega_km, migration 051) — fica genérico no parceiro, então o
-- Food pode passar a usar também. Vazio = não informou (filtro por bairro
-- cai no `bairro` do endereço).
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS bairros_entrega TEXT[] NOT NULL DEFAULT '{}';

-- Categoria do item DENTRO do Beer: 'cerveja' | 'vinho' | 'whisky' |
-- 'destilado' | 'champagne' | 'drink' | 'sem_alcool' | 'petisco' | 'gelo'.
-- Coluna própria em vez de reusar `categoria` (migration 025): aquela é a
-- categoria do marketplace ("Alimentação", "Casa"...), usada em outras
-- telas — misturar "whisky" ali quebraria esses filtros. NULL = item que
-- não é do cardápio de bebidas.
ALTER TABLE sindicato_parceiro_produtos
  ADD COLUMN IF NOT EXISTS beer_categoria VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_parceiro_produtos_beer_categoria
  ON sindicato_parceiro_produtos(beer_categoria) WHERE beer_categoria IS NOT NULL;

-- Log de compliance do +18: cada liberação da área registra quem (se
-- logado), como e de onde. NUNCA guarda CPF nem data de nascimento aqui —
-- o registro prova que a checagem aconteceu, sem virar mais uma cópia de
-- dado pessoal. associado_id NULL = visitante sem login (autodeclaração).
CREATE TABLE IF NOT EXISTS beer_verificacoes_idade (
  id           SERIAL PRIMARY KEY,
  associado_id INT REFERENCES sindicato_associados(id) ON DELETE SET NULL,
  -- 'cadastro' = maior de idade pela data de nascimento do cadastro SECI;
  -- 'autodeclaracao' = marcou "sou maior de 18" no modal;
  -- 'cpf_nascimento' = informou CPF + nascimento (POST /beer/verificar-idade)
  metodo       VARCHAR(20) NOT NULL,
  is_adult     BOOLEAN NOT NULL,
  ip           VARCHAR(50),
  user_agent   TEXT,
  verified_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beer_verificacoes_associado ON beer_verificacoes_idade(associado_id);
CREATE INDEX IF NOT EXISTS idx_beer_verificacoes_data ON beer_verificacoes_idade(verified_at);

-- Histórico de preço NORMAL dos produtos (Clube MAIS+, parte b0 — Junior,
-- 07/10/2026). Serve para conferir "desconto de fachada": o alerta do admin
-- compara o preço normal de quando a loja ativa/aumenta o desconto do Clube
-- com o menor preço dos 30 dias anteriores.
--
-- Gravado por GATILHO no banco: pega qualquer caminho que mude preço (painel,
-- cadastro por IA, admin, Disk Bebidas), sem depender de cada tela lembrar.
--   geral: preço normal = sindicato_parceiro_produtos.preco
--   beer:  preço normal = COALESCE(preco_original, preco) (com oferta ligada,
--          preco_original guarda o normal; ver migration 059)
-- Idempotente (o run.js roda todas as migrations de novo a cada vez).

CREATE TABLE IF NOT EXISTS precos_historico (
  id             BIGSERIAL PRIMARY KEY,
  catalogo       VARCHAR(5) NOT NULL CHECK (catalogo IN ('geral', 'beer')),
  item_id        INTEGER NOT NULL,          -- sindicato_parceiro_produtos.id ou beer_produtos.id
  parceiro_id    INTEGER,                   -- loja (no Beer, a dona do estabelecimento)
  preco_antes    NUMERIC(10,2),             -- NULL no primeiro registro
  preco_depois   NUMERIC(10,2),
  origem         VARCHAR(10) NOT NULL CHECK (origem IN ('inicial', 'cadastro', 'alteracao')),
  registrado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_precos_historico_item ON precos_historico (catalogo, item_id, registrado_em);
CREATE INDEX IF NOT EXISTS idx_precos_historico_parceiro ON precos_historico (parceiro_id, registrado_em);

-- Catálogo geral
CREATE OR REPLACE FUNCTION registrar_preco_produto() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
    VALUES ('geral', NEW.id, NEW.parceiro_id, NULL, NEW.preco, 'cadastro');
  ELSIF NEW.preco IS DISTINCT FROM OLD.preco THEN
    INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
    VALUES ('geral', NEW.id, NEW.parceiro_id, OLD.preco, NEW.preco, 'alteracao');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_precos_historico_produto ON sindicato_parceiro_produtos;
CREATE TRIGGER trg_precos_historico_produto
  AFTER INSERT OR UPDATE OF preco ON sindicato_parceiro_produtos
  FOR EACH ROW EXECUTE FUNCTION registrar_preco_produto();

-- Disk Bebidas
CREATE OR REPLACE FUNCTION registrar_preco_beer() RETURNS trigger AS $$
DECLARE
  normal_novo NUMERIC(10,2) := COALESCE(NEW.preco_original, NEW.preco);
  normal_antigo NUMERIC(10,2);
  loja INTEGER := (SELECT parceiro_id FROM beer_estabelecimentos WHERE id = NEW.estabelecimento_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
    VALUES ('beer', NEW.id, loja, NULL, normal_novo, 'cadastro');
  ELSE
    normal_antigo := COALESCE(OLD.preco_original, OLD.preco);
    IF normal_novo IS DISTINCT FROM normal_antigo THEN
      INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
      VALUES ('beer', NEW.id, loja, normal_antigo, normal_novo, 'alteracao');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_precos_historico_beer ON beer_produtos;
CREATE TRIGGER trg_precos_historico_beer
  AFTER INSERT OR UPDATE OF preco, preco_original ON beer_produtos
  FOR EACH ROW EXECUTE FUNCTION registrar_preco_beer();

-- Ponto de partida: o preço atual de quem ainda não tem registro.
INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
SELECT 'geral', p.id, p.parceiro_id, NULL, p.preco, 'inicial'
FROM sindicato_parceiro_produtos p
WHERE NOT EXISTS (SELECT 1 FROM precos_historico h WHERE h.catalogo = 'geral' AND h.item_id = p.id);

INSERT INTO precos_historico (catalogo, item_id, parceiro_id, preco_antes, preco_depois, origem)
SELECT 'beer', b.id, e.parceiro_id, NULL, COALESCE(b.preco_original, b.preco), 'inicial'
FROM beer_produtos b
JOIN beer_estabelecimentos e ON e.id = b.estabelecimento_id
WHERE NOT EXISTS (SELECT 1 FROM precos_historico h WHERE h.catalogo = 'beer' AND h.item_id = b.id);

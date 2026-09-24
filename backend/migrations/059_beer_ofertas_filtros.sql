-- IUB Disk Bebidas: ofertas do dia + campos dos filtros avançados da tela
-- de categoria. Execute: node migrations/run.js (aditivo e idempotente).
--
-- ROLLBACK (manual — run.js não tem "down"):
--   DROP INDEX IF EXISTS idx_beer_produtos_oferta;
--   ALTER TABLE beer_produtos DROP COLUMN IF EXISTS em_oferta, DROP COLUMN IF EXISTS preco_original,
--     DROP COLUMN IF EXISTS oferta_ate, DROP COLUMN IF EXISTS volume_ml, DROP COLUMN IF EXISTS origem;

-- Oferta (aba "🔥 Ofertas" do Meu IUB Beer). Ao ligar: preco_original =
-- preço normal e `preco` = preço com desconto. Ao desligar, volta.
-- Não existe cron: oferta VENCIDA (oferta_ate no passado) é tratada na
-- leitura — o público passa a ver COALESCE(preco_original, preco) na hora
-- (ver sqlPrecoVigente em beerController) e o painel desfaz a oferta na
-- próxima vez que o parceiro abre a lista.
ALTER TABLE beer_produtos
  ADD COLUMN IF NOT EXISTS em_oferta       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_original  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS oferta_ate      TIMESTAMPTZ;

-- Filtros avançados. Opcionais: gelo/carvão não têm ml, cerveja nacional
-- não precisa de origem. O filtro só aparece quando algum produto da
-- categoria tem o dado.
ALTER TABLE beer_produtos
  ADD COLUMN IF NOT EXISTS volume_ml  INT,           -- 350, 600, 750, 1000...
  ADD COLUMN IF NOT EXISTS origem     VARCHAR(60);   -- "Chile", "Escócia", "Minas Gerais"

CREATE INDEX IF NOT EXISTS idx_beer_produtos_oferta ON beer_produtos(oferta_ate) WHERE em_oferta = true;

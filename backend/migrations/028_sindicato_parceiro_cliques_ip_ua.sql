-- Bloco 7: WhatsApp inteligente do IUB MAIS. O clique no botao WhatsApp ja
-- e registrado (migration 026), mas sem ip/user_agent - precisamos disso
-- pro dashboard futuro distinguir cliques reais de bots/duplicados.
-- Execute: node migrations/run.js

ALTER TABLE sindicato_parceiro_cliques
  ADD COLUMN IF NOT EXISTS ip_origem  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);

-- Convênios exclusivos do SECI (parte "e" do Clube MAIS+, Junior 08/10/2026).
-- Antes ficavam escritos no código (frontend parceirosData.js) e apareciam
-- no marketplace público. Agora só o associado logado vê, em /meu/convenios.
-- Seed com os 9 convênios que existiam; o Renan passa a cuidar daqui.
CREATE TABLE IF NOT EXISTS seci_convenios (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(80)  NOT NULL UNIQUE,
  nome        VARCHAR(150) NOT NULL,
  categoria   VARCHAR(60),
  icone       VARCHAR(16),
  descricao   TEXT,
  beneficio   VARCHAR(255) NOT NULL,
  whatsapp    VARCHAR(20),
  endereco    VARCHAR(255),
  instagram   VARCHAR(255),
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO seci_convenios (slug, nome, categoria, icone, descricao, beneficio, whatsapp, endereco, instagram, ordem) VALUES
  ('nossa-drogaria', 'Nossa Drogaria', 'Saúde', '💊', 'Descontos exclusivos em produtos e medicamentos', 'Super descontos pra associados SECI', '64992991403', 'Itumbiara/GO', NULL, 1),
  ('academia-atletica', 'Academia Atlética', 'Esportes', '🏋️', 'Musculação, funcional e programas personalizados', 'Mensalidade especial R$ 30,00', NULL, 'Itumbiara/GO', NULL, 2),
  ('diroma-fiori', 'Diroma Fiori — Caldas Novas', 'Hospedagem', '🏨', 'Pacote de final de semana em Caldas Novas', 'R$ 300 sexta a domingo', '64992640899', 'Caldas Novas/GO', NULL, 3),
  ('oticas-diniz', 'Óticas Diniz', 'Beleza', '👓', 'Armações, lentes e acessórios', '20% de desconto', '6434320708', 'Itumbiara/GO', NULL, 4),
  ('ezequiel-nutricionista', 'Ezequiel Reis — Nutricionista', 'Saúde', '🥗', 'Consulta com nutricionista e plano alimentar', 'Consulta por R$ 70,00', '64993222304', 'Itumbiara/GO', NULL, 5),
  ('plenitude-psicologia', 'Plenitude — Psicologia', 'Saúde', '🧠', 'Psicoterapia adulto, infantil, ABA e neuropsicologia', 'Preço especial pra associados', '64992012585', 'Itumbiara/GO', NULL, 6),
  ('nesplora-neuropsicologia', 'Nesplora', 'Saúde', '🥽', 'Avaliação neuropsicológica com realidade virtual', 'R$ 400 com relatório', '64992012585', 'Itumbiara/GO', NULL, 7),
  ('laura-clemente-estetica', 'Laura Clemente — Estética', 'Beleza', '💆‍♀️', 'Estética corporal e facial', '10% de desconto em qualquer região', '64992300587', 'Itumbiara/GO', NULL, 8),
  ('studio-vip', 'Studio Vip — Beleza', 'Beleza', '💇‍♀️', 'Beleza e saúde capilar', '20% de desconto', NULL, 'Itumbiara/GO', NULL, 9)
ON CONFLICT (slug) DO NOTHING;

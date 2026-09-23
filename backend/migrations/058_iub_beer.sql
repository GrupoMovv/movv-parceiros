-- IUB DISK BEBIDAS (/beer, bebidas +18) — modelo HÍBRIDO:
--   sindicato_parceiros (login, plano, assinatura MP, painel — ÚNICOS)
--     └─ 1:1 opcional ─> beer_estabelecimentos (dados só do Disk Bebidas)
--                          └─> beer_produtos (catálogo próprio, moderado)
-- Não existe plano_beer: vale o plano do parceiro (serve Food e Beer).
-- Produto de bebida NÃO vai pra sindicato_parceiro_produtos de propósito:
-- lá ele apareceria nas vitrines/busca do marketplace geral, que não tem
-- porta +18 — beer_produtos só é lido pelas rotas /beer.
-- Execute: node migrations/run.js (tudo idempotente — run.js reroda todos
-- os arquivos toda vez).
--
-- ROLLBACK (manual — run.js não tem "down"; rodar só pra desfazer o Beer):
--   DROP TABLE IF EXISTS beer_log_moderacao;
--   DROP TABLE IF EXISTS beer_produtos;
--   DROP TABLE IF EXISTS beer_categorias;
--   DROP TABLE IF EXISTS beer_estabelecimentos;
--   DROP TABLE IF EXISTS beer_verificacoes_idade;

-- A primeira versão desta migration (fase A — só aplicada no banco, nunca
-- publicada) punha esses campos direto no parceiro/produto geral. Agora
-- moram nas tabelas beer_*. Colunas vazias, sem uso em código nenhum.
DROP INDEX IF EXISTS idx_parceiro_produtos_beer_categoria;
ALTER TABLE sindicato_parceiro_produtos DROP COLUMN IF EXISTS beer_categoria;
ALTER TABLE sindicato_parceiros DROP COLUMN IF EXISTS beer_tipo;
ALTER TABLE sindicato_parceiros DROP COLUMN IF EXISTS bairros_entrega;

-- Extensão Disk Bebidas do parceiro. Ter a linha com ativo = true é o que
-- põe o parceiro no /beer; "sair do Beer" = ativo false, sem mexer no resto
-- da conta. IDs SERIAL/INT como o resto do banco (sindicato_parceiros não
-- é UUID).
CREATE TABLE IF NOT EXISTS beer_estabelecimentos (
  id                     SERIAL PRIMARY KEY,
  parceiro_id            INT NOT NULL UNIQUE REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  -- adega | distribuidora | bar | conveniencia | emporio (ver config/beer.js)
  tipo                   VARCHAR(30) NOT NULL,
  cnae                   VARCHAR(10),          -- só dígitos, ex.: 4723700
  whatsapp               VARCHAR(20) NOT NULL, -- WhatsApp comercial dos pedidos
  -- mesmo formato do parceiro (migration 025): {"seg": {"aberto": true, "abre": "18:00", "fecha": "02:00"}, ...}
  -- próprio do Beer: o bar pode ter horário de bebidas diferente do restaurante
  horario_funcionamento  JSONB NOT NULL DEFAULT '{}',
  bairros_entrega        TEXT[] NOT NULL DEFAULT '{}',
  tempo_entrega_min      INT,                  -- filtro "Até 30/45 min" do Quero Agora
  retirada_disponivel    BOOLEAN NOT NULL DEFAULT false,
  -- Botão "Aberto agora" do painel. Manual de propósito: disk bebidas abre e
  -- fecha fora de horário fixo (acabou o estoque, abriu mais cedo no jogo).
  status_aberto          BOOLEAN NOT NULL DEFAULT false,
  ultimo_status_update   TIMESTAMPTZ,
  -- Termo IUB DISK BEBIDAS (aceite obrigatório pra ativar); versão = data do texto
  termo_versao           VARCHAR(20) NOT NULL,
  termo_aceito_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  termo_aceito_ip        VARCHAR(50),
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beer_estabelecimentos_ativo ON beer_estabelecimentos(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_beer_estabelecimentos_aberto ON beer_estabelecimentos(status_aberto) WHERE status_aberto = true;

-- Catálogo FECHADO de categorias (camada 1 da proteção: o parceiro só
-- escolhe daqui, sem campo livre nem "outros"). Hierarquia de 2 níveis na
-- mesma tabela: categoria_pai NULL = grupo ("cervejas"), o resto aponta pro
-- grupo. `regulamentada` = produto com regra legal própria (cigarros) — o
-- front mostra aviso extra.
CREATE TABLE IF NOT EXISTS beer_categorias (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(100) NOT NULL UNIQUE,
  nome_exibicao   VARCHAR(200) NOT NULL,
  categoria_pai   VARCHAR(100),
  icone           VARCHAR(20),
  ordem           INT NOT NULL DEFAULT 0,
  regulamentada   BOOLEAN NOT NULL DEFAULT false,
  ativo           BOOLEAN NOT NULL DEFAULT true
);

-- Produto do Disk Bebidas. Só aparece no /beer com status = aprovado
-- (camada 3: moderação manual) E disponivel = true. Editar nome, descrição,
-- categoria ou foto de um aprovado volta pra pendente (ver
-- parceiroBeerController) — senão dava pra aprovar algo inocente e trocar
-- depois.
CREATE TABLE IF NOT EXISTS beer_produtos (
  id                  SERIAL PRIMARY KEY,
  estabelecimento_id  INT NOT NULL REFERENCES beer_estabelecimentos(id) ON DELETE CASCADE,
  -- FK pro catálogo: categoria fora da lista não entra nem por API direta
  categoria_codigo    VARCHAR(100) NOT NULL REFERENCES beer_categorias(codigo),
  nome                VARCHAR(200) NOT NULL,
  descricao           TEXT,
  preco               NUMERIC(10,2) NOT NULL,
  imagem              VARCHAR(500),
  imagem_public_id    VARCHAR(300),           -- pra apagar do Cloudinary ao trocar/excluir
  disponivel          BOOLEAN NOT NULL DEFAULT true,   -- no cardápio (pausa sem excluir)
  disponivel_agora    BOOLEAN NOT NULL DEFAULT false,  -- entra no "Quero Agora"
  -- {"todos": true} ou {"sab": true, "dom": true} — chaves iguais ao horário (seg..dom)
  dias_disponiveis    JSONB NOT NULL DEFAULT '{"todos": true}',
  destaque            BOOLEAN NOT NULL DEFAULT false,
  -- pendente | aprovado | rejeitado
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
  motivo_rejeicao     TEXT,
  -- termos de contexto achados no cadastro (coca, doce, cristal...): não
  -- bloqueiam, ficam em destaque pro moderador
  termos_sinalizados  TEXT[] NOT NULL DEFAULT '{}',
  aprovado_por        INT,                    -- partners.id do admin (sem FK: admin pode sair)
  aprovado_em         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beer_produtos_estabelecimento ON beer_produtos(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_beer_produtos_categoria ON beer_produtos(categoria_codigo);
CREATE INDEX IF NOT EXISTS idx_beer_produtos_visiveis ON beer_produtos(disponivel, status) WHERE disponivel = true AND status = 'aprovado';
CREATE INDEX IF NOT EXISTS idx_beer_produtos_agora ON beer_produtos(disponivel_agora) WHERE disponivel_agora = true;
CREATE INDEX IF NOT EXISTS idx_beer_produtos_pendentes ON beer_produtos(created_at) WHERE status = 'pendente';

-- Log de compliance do +18 (mesma tabela da fase A, já existe no banco — o
-- IF NOT EXISTS não recria). NUNCA guarda CPF nem data de nascimento: prova
-- que a checagem aconteceu sem virar mais uma cópia de dado pessoal.
CREATE TABLE IF NOT EXISTS beer_verificacoes_idade (
  id           SERIAL PRIMARY KEY,
  associado_id INT REFERENCES sindicato_associados(id) ON DELETE SET NULL,
  -- cadastro (nascimento do cadastro SECI) | autodeclaracao (checkbox) | cpf_nascimento
  metodo       VARCHAR(20) NOT NULL,
  is_adult     BOOLEAN NOT NULL,
  ip           VARCHAR(50),
  user_agent   TEXT,
  verified_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beer_verificacoes_associado ON beer_verificacoes_idade(associado_id);
CREATE INDEX IF NOT EXISTS idx_beer_verificacoes_data ON beer_verificacoes_idade(verified_at);

-- Log de moderação (compliance): tentativa de cadastrar termo proibido,
-- aprovação e rejeição. Guarda o texto tentado de propósito — é a prova de
-- que o bloqueio aconteceu e de quem tentou.
CREATE TABLE IF NOT EXISTS beer_log_moderacao (
  id                  SERIAL PRIMARY KEY,
  -- tentativa_cadastro_proibido | aprovacao | rejeicao
  tipo                VARCHAR(50) NOT NULL,
  estabelecimento_id  INT REFERENCES beer_estabelecimentos(id) ON DELETE SET NULL,
  produto_id          INT REFERENCES beer_produtos(id) ON DELETE SET NULL,
  produto_nome        VARCHAR(500),
  produto_descricao   TEXT,
  palavra_detectada   VARCHAR(200),
  admin_id            INT,
  motivo              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beer_log_moderacao_tipo ON beer_log_moderacao(tipo, created_at);

-- Seed do catálogo. ON CONFLICT atualiza rótulo/ordem/ícone (reeditar aqui e
-- rodar de novo corrige nomes) mas NÃO mexe em `ativo`: desligar uma
-- categoria direto no banco continua valendo depois de um novo deploy.
INSERT INTO beer_categorias (codigo, nome_exibicao, categoria_pai, icone, ordem, regulamentada) VALUES
  ('cervejas', 'Cervejas', NULL, '🍺', 100, false),
  ('cerveja_comercial', 'Cerveja Comercial', 'cervejas', '🍺', 101, false),
  ('cerveja_artesanal', 'Cerveja Artesanal', 'cervejas', '🍺', 102, false),
  ('cerveja_importada', 'Cerveja Importada', 'cervejas', '🍺', 103, false),
  ('chopp', 'Chopp', 'cervejas', '🍺', 104, false),
  ('vinhos', 'Vinhos', NULL, '🍷', 200, false),
  ('vinho_tinto', 'Vinho Tinto', 'vinhos', '🍷', 201, false),
  ('vinho_branco', 'Vinho Branco', 'vinhos', '🍷', 202, false),
  ('vinho_rose', 'Vinho Rosé', 'vinhos', '🍷', 203, false),
  ('vinho_espumante_frisante', 'Frisante', 'vinhos', '🍷', 204, false),
  ('vinho_sem_alcool', 'Vinho sem Álcool', 'vinhos', '🍷', 205, false),
  ('sangria', 'Sangria', 'vinhos', '🍷', 206, false),
  ('espumantes', 'Espumantes', NULL, '🥂', 300, false),
  ('espumante_brut', 'Espumante Brut', 'espumantes', '🥂', 301, false),
  ('extra_brut', 'Extra Brut', 'espumantes', '🥂', 302, false),
  ('espumante_nature', 'Espumante Nature', 'espumantes', '🥂', 303, false),
  ('espumante_demi_sec', 'Espumante Demi-Sec', 'espumantes', '🥂', 304, false),
  ('espumante_moscatel', 'Espumante Moscatel', 'espumantes', '🥂', 305, false),
  ('espumante_rose', 'Espumante Rosé', 'espumantes', '🥂', 306, false),
  ('prosecco', 'Prosecco', 'espumantes', '🥂', 307, false),
  ('cava', 'Cava', 'espumantes', '🥂', 308, false),
  ('champagne', 'Champagne', 'espumantes', '🥂', 309, false),
  ('espumante_sem_alcool', 'Espumante sem Álcool', 'espumantes', '🥂', 310, false),
  ('whisky', 'Whisky', NULL, '🥃', 400, false),
  ('whisky_scotch', 'Scotch', 'whisky', '🥃', 401, false),
  ('whisky_bourbon', 'Bourbon', 'whisky', '🥃', 402, false),
  ('whisky_tennessee', 'Tennessee', 'whisky', '🥃', 403, false),
  ('whisky_irish', 'Irish', 'whisky', '🥃', 404, false),
  ('whisky_japanese', 'Japonês', 'whisky', '🥃', 405, false),
  ('whisky_nacional', 'Nacional', 'whisky', '🥃', 406, false),
  ('whisky_premium', 'Premium', 'whisky', '🥃', 407, false),
  ('whisky_super_premium', 'Super Premium', 'whisky', '🥃', 408, false),
  ('cachacas', 'Cachaças', NULL, '🥃', 500, false),
  ('cachaca_branca', 'Cachaça Branca', 'cachacas', '🥃', 501, false),
  ('cachaca_ouro', 'Cachaça Ouro', 'cachacas', '🥃', 502, false),
  ('cachaca_envelhecida', 'Cachaça Envelhecida', 'cachacas', '🥃', 503, false),
  ('cachaca_premium', 'Cachaça Premium', 'cachacas', '🥃', 504, false),
  ('cachaca_artesanal', 'Cachaça Artesanal', 'cachacas', '🥃', 505, false),
  ('cachaca_regional', 'Cachaça Regional', 'cachacas', '🥃', 506, false),
  ('destilados', 'Destilados', NULL, '🍸', 600, false),
  ('vodka', 'Vodka', 'destilados', '🍸', 601, false),
  ('gin', 'Gin', 'destilados', '🍸', 602, false),
  ('rum', 'Rum', 'destilados', '🍸', 603, false),
  ('tequila', 'Tequila', 'destilados', '🍸', 604, false),
  ('conhaque', 'Conhaque', 'destilados', '🍸', 605, false),
  ('brandy', 'Brandy', 'destilados', '🍸', 606, false),
  ('pisco', 'Pisco', 'destilados', '🍸', 607, false),
  ('grappa', 'Grappa', 'destilados', '🍸', 608, false),
  ('aguardente', 'Aguardente', 'destilados', '🍸', 609, false),
  ('aperitivos_licores', 'Aperitivos e Licores', NULL, '🍹', 700, false),
  ('campari', 'Campari', 'aperitivos_licores', '🍹', 701, false),
  ('aperol', 'Aperol', 'aperitivos_licores', '🍹', 702, false),
  ('martini_vermute', 'Martini / Vermute', 'aperitivos_licores', '🍹', 703, false),
  ('cinzano', 'Cinzano', 'aperitivos_licores', '🍹', 704, false),
  ('jagermeister', 'Jägermeister', 'aperitivos_licores', '🍹', 705, false),
  ('fernet', 'Fernet', 'aperitivos_licores', '🍹', 706, false),
  ('underberg', 'Underberg', 'aperitivos_licores', '🍹', 707, false),
  ('amaro_bitter', 'Amaro / Bitter', 'aperitivos_licores', '🍹', 708, false),
  ('amaretto', 'Amaretto', 'aperitivos_licores', '🍹', 709, false),
  ('baileys', 'Baileys', 'aperitivos_licores', '🍹', 710, false),
  ('frangelico', 'Frangelico', 'aperitivos_licores', '🍹', 711, false),
  ('kahlua', 'Kahlúa', 'aperitivos_licores', '🍹', 712, false),
  ('cointreau', 'Cointreau', 'aperitivos_licores', '🍹', 713, false),
  ('grand_marnier', 'Grand Marnier', 'aperitivos_licores', '🍹', 714, false),
  ('licor_43', 'Licor 43', 'aperitivos_licores', '🍹', 715, false),
  ('sambuca', 'Sambuca', 'aperitivos_licores', '🍹', 716, false),
  ('curacao_blue', 'Curaçao Blue', 'aperitivos_licores', '🍹', 717, false),
  ('peppermint', 'Peppermint', 'aperitivos_licores', '🍹', 718, false),
  ('triple_sec', 'Triple Sec', 'aperitivos_licores', '🍹', 719, false),
  ('licor_frutas', 'Licor de Frutas', 'aperitivos_licores', '🍹', 720, false),
  ('licor_ervas', 'Licor de Ervas', 'aperitivos_licores', '🍹', 721, false),
  ('licor_creme', 'Licor Cremoso', 'aperitivos_licores', '🍹', 722, false),
  ('licor_cafe', 'Licor de Café', 'aperitivos_licores', '🍹', 723, false),
  ('licor_chocolate', 'Licor de Chocolate', 'aperitivos_licores', '🍹', 724, false),
  ('drinks_prontos', 'Drinks Prontos', NULL, '🍸', 800, false),
  ('caipirinha_pronta', 'Caipirinha', 'drinks_prontos', '🍸', 801, false),
  ('caipiroska', 'Caipiroska', 'drinks_prontos', '🍸', 802, false),
  ('gin_tonica_pronto', 'Gin Tônica', 'drinks_prontos', '🍸', 803, false),
  ('moscow_mule', 'Moscow Mule', 'drinks_prontos', '🍸', 804, false),
  ('margarita_pronta', 'Margarita', 'drinks_prontos', '🍸', 805, false),
  ('mojito_pronto', 'Mojito', 'drinks_prontos', '🍸', 806, false),
  ('negroni_pronto', 'Negroni', 'drinks_prontos', '🍸', 807, false),
  ('aperol_spritz_pronto', 'Aperol Spritz', 'drinks_prontos', '🍸', 808, false),
  ('pina_colada_pronta', 'Piña Colada', 'drinks_prontos', '🍸', 809, false),
  ('bloody_mary_pronto', 'Bloody Mary', 'drinks_prontos', '🍸', 810, false),
  ('long_island_pronto', 'Long Island', 'drinks_prontos', '🍸', 811, false),
  ('hard_seltzer', 'Hard Seltzer', 'drinks_prontos', '🍸', 812, false),
  ('ice_cooler', 'Ice / Cooler', 'drinks_prontos', '🍸', 813, false),
  ('sake_oriental', 'Saquê e Oriental', NULL, '🍶', 900, false),
  ('sake', 'Saquê', 'sake_oriental', '🍶', 901, false),
  ('shochu', 'Shochu', 'sake_oriental', '🍶', 902, false),
  ('soju', 'Soju', 'sake_oriental', '🍶', 903, false),
  ('sem_alcool', 'Sem Álcool', NULL, '🥤', 1000, false),
  ('refrigerante_cola', 'Refrigerante Cola', 'sem_alcool', '🥤', 1001, false),
  ('refrigerante_guarana', 'Guaraná', 'sem_alcool', '🥤', 1002, false),
  ('refrigerante_laranja', 'Refrigerante Laranja', 'sem_alcool', '🥤', 1003, false),
  ('refrigerante_limao', 'Refrigerante Limão', 'sem_alcool', '🥤', 1004, false),
  ('refrigerante_uva', 'Refrigerante Uva', 'sem_alcool', '🥤', 1005, false),
  ('refrigerante_tonica', 'Água Tônica', 'sem_alcool', '🥤', 1006, false),
  ('agua_mineral', 'Água Mineral', 'sem_alcool', '🥤', 1007, false),
  ('agua_com_gas', 'Água com Gás', 'sem_alcool', '🥤', 1008, false),
  ('agua_coco', 'Água de Coco', 'sem_alcool', '🥤', 1009, false),
  ('suco_natural', 'Suco Natural', 'sem_alcool', '🥤', 1010, false),
  ('suco_industrializado', 'Suco Industrializado', 'sem_alcool', '🥤', 1011, false),
  ('cha_gelado', 'Chá Gelado', 'sem_alcool', '🥤', 1012, false),
  ('energetico', 'Energético', 'sem_alcool', '🥤', 1013, false),
  ('isotonico', 'Isotônico', 'sem_alcool', '🥤', 1014, false),
  ('kombucha', 'Kombucha', 'sem_alcool', '🥤', 1015, false),
  ('ginger_ale', 'Ginger Ale', 'sem_alcool', '🥤', 1016, false),
  ('ginger_beer', 'Ginger Beer', 'sem_alcool', '🥤', 1017, false),
  ('gelo', 'Gelo', NULL, '🧊', 1100, false),
  ('gelo_cubos', 'Gelo em Cubos', 'gelo', '🧊', 1101, false),
  ('gelo_triturado', 'Gelo Triturado', 'gelo', '🧊', 1102, false),
  ('gelo_barra', 'Gelo em Barra', 'gelo', '🧊', 1103, false),
  ('gelo_cristal', 'Gelo Cristal', 'gelo', '🧊', 1104, false),
  ('gelo_saco', 'Saco de Gelo', 'gelo', '🧊', 1105, false),
  ('gelo_para_drinks', 'Gelo para Drinks', 'gelo', '🧊', 1106, false),
  ('mixers', 'Mixers para Drinks', NULL, '🍋', 1200, false),
  ('mixer_tonica', 'Tônica', 'mixers', '🍋', 1201, false),
  ('mixer_ginger', 'Ginger', 'mixers', '🍋', 1202, false),
  ('mixer_soda', 'Soda', 'mixers', '🍋', 1203, false),
  ('xarope_grenadine', 'Xarope / Grenadine', 'mixers', '🍋', 1204, false),
  ('bitter_drink', 'Bitter', 'mixers', '🍋', 1205, false),
  ('mix_pronto_drinks', 'Mix Pronto para Drinks', 'mixers', '🍋', 1206, false),
  ('ingredientes_drinks', 'Ingredientes para Drinks', NULL, '🍓', 1300, false),
  ('fruta_limao', 'Limão', 'ingredientes_drinks', '🍓', 1301, false),
  ('fruta_laranja', 'Laranja', 'ingredientes_drinks', '🍓', 1302, false),
  ('fruta_morango', 'Morango', 'ingredientes_drinks', '🍓', 1303, false),
  ('fruta_maracuja', 'Maracujá', 'ingredientes_drinks', '🍓', 1304, false),
  ('fruta_abacaxi', 'Abacaxi', 'ingredientes_drinks', '🍓', 1305, false),
  ('erva_hortela', 'Hortelã', 'ingredientes_drinks', '🍓', 1306, false),
  ('erva_alecrim', 'Alecrim', 'ingredientes_drinks', '🍓', 1307, false),
  ('complemento_acucar', 'Açúcar', 'ingredientes_drinks', '🍓', 1308, false),
  ('complemento_sal_margarita', 'Sal para Margarita', 'ingredientes_drinks', '🍓', 1309, false),
  ('complemento_azeitona', 'Azeitona para Drinks', 'ingredientes_drinks', '🍓', 1310, false),
  ('complemento_cereja', 'Cereja', 'ingredientes_drinks', '🍓', 1311, false),
  ('petiscos', 'Petiscos', NULL, '🥜', 1400, false),
  ('amendoim_castanhas', 'Amendoim e Castanhas', 'petiscos', '🥜', 1401, false),
  ('salgadinhos', 'Salgadinhos', 'petiscos', '🥜', 1402, false),
  ('batata_palha', 'Batata Palha', 'petiscos', '🥜', 1403, false),
  ('batata_frita_congelada', 'Batata Frita Congelada', 'petiscos', '🥜', 1404, false),
  ('balas_chicletes', 'Balas e Chicletes', 'petiscos', '🥜', 1405, false),
  ('pipoca', 'Pipoca', 'petiscos', '🥜', 1406, false),
  ('isca_calabresa', 'Isca de Calabresa', 'petiscos', '🥜', 1407, false),
  ('torresmo', 'Torresmo', 'petiscos', '🥜', 1408, false),
  ('azeitona', 'Azeitona', 'petiscos', '🥜', 1409, false),
  ('queijo_curado', 'Queijo Curado', 'petiscos', '🥜', 1410, false),
  ('salame_copa', 'Salame e Copa', 'petiscos', '🥜', 1411, false),
  ('presunto_embalado', 'Presunto', 'petiscos', '🥜', 1412, false),
  ('pastel_frito', 'Pastel', 'petiscos', '🥜', 1413, false),
  ('comidas_prontas', 'Comidas Prontas', NULL, '🍽️', 1500, false),
  ('frango_assado_inteiro', 'Frango Assado Inteiro', 'comidas_prontas', '🍽️', 1501, false),
  ('frango_assado_pedaco', 'Frango Assado em Pedaços', 'comidas_prontas', '🍽️', 1502, false),
  ('frango_caipira', 'Frango Caipira', 'comidas_prontas', '🍽️', 1503, false),
  ('frango_passarinho', 'Frango a Passarinho', 'comidas_prontas', '🍽️', 1504, false),
  ('costela_assada', 'Costela Assada', 'comidas_prontas', '🍽️', 1505, false),
  ('costela_suina', 'Costela Suína', 'comidas_prontas', '🍽️', 1506, false),
  ('leitao_assado', 'Leitão Assado', 'comidas_prontas', '🍽️', 1507, false),
  ('peixe_assado', 'Peixe Assado', 'comidas_prontas', '🍽️', 1508, false),
  ('espetinhos_prontos', 'Espetinhos', 'comidas_prontas', '🍽️', 1509, false),
  ('feijoada', 'Feijoada', 'comidas_prontas', '🍽️', 1510, false),
  ('feijao_tropeiro', 'Feijão Tropeiro', 'comidas_prontas', '🍽️', 1511, false),
  ('empadao_goiano', 'Empadão Goiano', 'comidas_prontas', '🍽️', 1512, false),
  ('pequi_com_frango', 'Frango com Pequi', 'comidas_prontas', '🍽️', 1513, false),
  ('salpicao', 'Salpicão', 'comidas_prontas', '🍽️', 1514, false),
  ('maionese_batata', 'Maionese de Batata', 'comidas_prontas', '🍽️', 1515, false),
  ('salada_macarrao', 'Salada de Macarrão', 'comidas_prontas', '🍽️', 1516, false),
  ('salada_batata', 'Salada de Batata', 'comidas_prontas', '🍽️', 1517, false),
  ('salada_verde', 'Salada Verde', 'comidas_prontas', '🍽️', 1518, false),
  ('salada_milho', 'Salada de Milho', 'comidas_prontas', '🍽️', 1519, false),
  ('arroz_branco', 'Arroz Branco', 'comidas_prontas', '🍽️', 1520, false),
  ('arroz_temperado', 'Arroz Temperado', 'comidas_prontas', '🍽️', 1521, false),
  ('arroz_pequi', 'Arroz com Pequi', 'comidas_prontas', '🍽️', 1522, false),
  ('mandioca_cozida', 'Mandioca Cozida', 'comidas_prontas', '🍽️', 1523, false),
  ('mandioca_frita', 'Mandioca Frita', 'comidas_prontas', '🍽️', 1524, false),
  ('milho_verde', 'Milho Verde', 'comidas_prontas', '🍽️', 1525, false),
  ('batata_frita_porcao', 'Porção de Batata Frita', 'comidas_prontas', '🍽️', 1526, false),
  ('pao_de_queijo', 'Pão de Queijo', 'comidas_prontas', '🍽️', 1527, false),
  ('pamonha', 'Pamonha', 'comidas_prontas', '🍽️', 1528, false),
  ('curau', 'Curau', 'comidas_prontas', '🍽️', 1529, false),
  ('coxinha', 'Coxinha', 'comidas_prontas', '🍽️', 1530, false),
  ('kibe', 'Kibe', 'comidas_prontas', '🍽️', 1531, false),
  ('esfiha', 'Esfiha', 'comidas_prontas', '🍽️', 1532, false),
  ('torta_salgada', 'Torta Salgada', 'comidas_prontas', '🍽️', 1533, false),
  ('empadinha', 'Empadinha', 'comidas_prontas', '🍽️', 1534, false),
  ('salgado_assado', 'Salgado Assado', 'comidas_prontas', '🍽️', 1535, false),
  ('pudim', 'Pudim', 'comidas_prontas', '🍽️', 1536, false),
  ('doce_leite', 'Doce de Leite', 'comidas_prontas', '🍽️', 1537, false),
  ('bolo_caseiro', 'Bolo Caseiro', 'comidas_prontas', '🍽️', 1538, false),
  ('churrasco', 'Churrasco', NULL, '🔥', 1600, false),
  ('carvao', 'Carvão', 'churrasco', '🔥', 1601, false),
  ('acendedor', 'Acendedor', 'churrasco', '🔥', 1602, false),
  ('sal_grosso', 'Sal Grosso', 'churrasco', '🔥', 1603, false),
  ('farofa_pronta', 'Farofa Pronta', 'churrasco', '🔥', 1604, false),
  ('vinagrete_pronto', 'Vinagrete', 'churrasco', '🔥', 1605, false),
  ('molho_churrasco', 'Molho para Churrasco', 'churrasco', '🔥', 1606, false),
  ('espeto_churrasco', 'Espeto', 'churrasco', '🔥', 1607, false),
  ('festa', 'Festa', NULL, '🎉', 1700, false),
  ('copo_descartavel', 'Copo Descartável', 'festa', '🎉', 1701, false),
  ('taca_descartavel', 'Taça Descartável', 'festa', '🎉', 1702, false),
  ('prato_descartavel', 'Prato Descartável', 'festa', '🎉', 1703, false),
  ('talher_descartavel', 'Talher Descartável', 'festa', '🎉', 1704, false),
  ('guardanapo', 'Guardanapo', 'festa', '🎉', 1705, false),
  ('canudo', 'Canudo', 'festa', '🎉', 1706, false),
  ('cooler', 'Cooler', 'festa', '🎉', 1707, false),
  ('balde_gelo', 'Balde de Gelo', 'festa', '🎉', 1708, false),
  ('caixa_termica', 'Caixa Térmica', 'festa', '🎉', 1709, false),
  ('sacola_termica', 'Sacola Térmica', 'festa', '🎉', 1710, false),
  ('abridor', 'Abridor', 'festa', '🎉', 1711, false),
  ('saca_rolhas', 'Saca-Rolhas', 'festa', '🎉', 1712, false),
  ('acessorios_drinks', 'Acessórios para Drinks', NULL, '🍸', 1800, false),
  ('coqueteleira', 'Coqueteleira', 'acessorios_drinks', '🍸', 1801, false),
  ('jigger_dosador', 'Jigger / Dosador', 'acessorios_drinks', '🍸', 1802, false),
  ('colher_bailarina', 'Colher Bailarina', 'acessorios_drinks', '🍸', 1803, false),
  ('macerador', 'Macerador', 'acessorios_drinks', '🍸', 1804, false),
  ('coador_strainer', 'Coador / Strainer', 'acessorios_drinks', '🍸', 1805, false),
  ('copo_medidor', 'Copo Medidor', 'acessorios_drinks', '🍸', 1806, false),
  ('pinca_gelo', 'Pinça de Gelo', 'acessorios_drinks', '🍸', 1807, false),
  ('copo_gin', 'Taça de Gin', 'acessorios_drinks', '🍸', 1808, false),
  ('taca_vinho', 'Taça de Vinho', 'acessorios_drinks', '🍸', 1809, false),
  ('taca_espumante', 'Taça de Espumante', 'acessorios_drinks', '🍸', 1810, false),
  ('copo_old_fashioned', 'Copo Old Fashioned', 'acessorios_drinks', '🍸', 1811, false),
  ('copo_highball', 'Copo Highball', 'acessorios_drinks', '🍸', 1812, false),
  ('copo_shot', 'Copo de Shot', 'acessorios_drinks', '🍸', 1813, false),
  ('kit_bartender', 'Kit Bartender', 'acessorios_drinks', '🍸', 1814, false),
  ('cigarros', 'Cigarros', NULL, '🚬', 1900, true),
  ('cigarro_comum', 'Cigarro', 'cigarros', '🚬', 1901, true)

ON CONFLICT (codigo) DO UPDATE SET
  nome_exibicao = EXCLUDED.nome_exibicao,
  categoria_pai = EXCLUDED.categoria_pai,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  regulamentada = EXCLUDED.regulamentada;

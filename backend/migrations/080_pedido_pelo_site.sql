-- Pedido pelo site, parte 1 (Junior, 05/10/2026): botão "Comprar" ao lado do
-- "Chamar no WhatsApp". O DINHEIRO NÃO PASSA PELO IUB: o cliente paga direto
-- no Pix da loja; o IUB só registra e acompanha. Sem Mercado Pago/split.
-- Só colunas e tabelas novas. Idempotente (o Build Command roda
-- npm run migrate a cada deploy).
-- Execute: node migrations/run.js

-- ── Loja ────────────────────────────────────────────────────────────────
-- pedidos_site_ativo: desligado por padrão. Só liga com horário cadastrado
-- e depois de a loja CONFIRMAR horário, entrega/retirada e taxa
-- (pedidos_confirmado_em) — os padrões da migration 051 não valem como
-- confirmação (retirada_disponivel nasce true pra todo mundo).
-- pix_nome_recebedor até 25 caracteres = limite do QR Pix (BR Code).
ALTER TABLE sindicato_parceiros
  ADD COLUMN IF NOT EXISTS pedidos_site_ativo        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pedidos_pausados          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pedidos_aceite_automatico BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pedidos_confirmado_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_chave                 VARCHAR(140),
  ADD COLUMN IF NOT EXISTS pix_tipo                  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pix_nome_recebedor        VARCHAR(25);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_pix_tipo_ok') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_pix_tipo_ok
      CHECK (pix_tipo IS NULL OR pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria'));
  END IF;
  -- Ligado exige chave Pix e confirmação (vale pra qualquer tela, inclusive admin)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_pedidos_site_requisitos') THEN
    ALTER TABLE sindicato_parceiros ADD CONSTRAINT parceiro_pedidos_site_requisitos
      CHECK (NOT pedidos_site_ativo OR (pix_chave IS NOT NULL AND pix_tipo IS NOT NULL AND pedidos_confirmado_em IS NOT NULL));
  END IF;
END $$;

-- ── Cliente: WhatsApp confirmado ───────────────────────────────────────
-- Confirmado = whatsapp_verificado é o MESMO número de whatsapp. Trocou o
-- número em qualquer tela, deixa de bater e pede código de novo (sem
-- precisar lembrar de limpar a flag em cada UPDATE).
ALTER TABLE sindicato_associados
  ADD COLUMN IF NOT EXISTS whatsapp_verificado     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp_verificado_em  TIMESTAMPTZ;

-- Código de confirmação por WhatsApp (Z-API). Tabela própria pra não
-- misturar com senha_codigos: o "esqueci a senha" não pode consumir este
-- código, nem o contrário. Mesmo desenho: bcrypt, validade, tentativas,
-- uso único.
CREATE TABLE IF NOT EXISTS whatsapp_codigos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id  INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  whatsapp      VARCHAR(20) NOT NULL,          -- número que recebeu o código
  codigo_hash   VARCHAR(100) NOT NULL,
  expira_em     TIMESTAMPTZ NOT NULL,
  tentativas    INTEGER NOT NULL DEFAULT 0,
  usado_em      TIMESTAMPTZ,
  ip            VARCHAR(64),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_codigos_associado ON whatsapp_codigos(associado_id, criado_em);

-- ── Pedido ─────────────────────────────────────────────────────────────
-- status:
--   enviado    -> cliente mandou; loja tem 10 min pra aceitar/recusar
--                 (pulado com aceite automático)
--   aceito     -> loja aceitou; cliente vê a chave Pix e o total; loja tem
--                 2h pra marcar pago, senão cancela sozinho
--   pago_saiu  -> loja confirmou o Pix e saiu pra entrega ("Pago, pode
--                 retirar" na retirada); fecha sozinho em 3h (entrega) /
--                 12h (retirada) ou quando o cliente confirma
--   entregue   -> encerrado com sucesso
--   recusado   -> loja recusou
--   cancelado  -> cliente (só enquanto 'enviado'), loja, ou sistema (2h sem pago)
--   expirado   -> loja não respondeu em 10 min
-- Um pedido = uma loja. catalogo 'beer' = itens de beer_produtos: aviso de
-- idade na entrega, e retirada/bairros/aberto vêm de beer_estabelecimentos.
-- Os prazos ficam em config (backend), não aqui.
-- Cópia de cliente/endereço/Pix no pedido: o pedido mostra o que valia na
-- hora, mesmo se a conta ou a loja mudarem depois.
-- token_loja: link do WhatsApp que abre o pedido sem login. Vale até
-- encerrado_em + 24h (conferido na leitura).
-- FUTURO (fora da V1, colunas já previstas): tipo_entrega 'full',
-- entregador_id (ainda não existe tabela de entregadores, por isso sem FK),
-- forma_pagamento além de pix.
CREATE TABLE IF NOT EXISTS loja_pedidos (
  id                       SERIAL PRIMARY KEY,
  parceiro_id              INTEGER NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  associado_id             INTEGER NOT NULL REFERENCES sindicato_associados(id) ON DELETE CASCADE,
  catalogo                 VARCHAR(5) NOT NULL DEFAULT 'geral' CHECK (catalogo IN ('geral', 'beer')),
  beer_estabelecimento_id  INTEGER REFERENCES beer_estabelecimentos(id) ON DELETE SET NULL,
  status                   VARCHAR(10) NOT NULL DEFAULT 'enviado'
                           CHECK (status IN ('enviado', 'aceito', 'pago_saiu', 'entregue', 'recusado', 'cancelado', 'expirado')),
  -- cliente (cópia)
  cliente_nome             VARCHAR(160) NOT NULL,
  cliente_whatsapp         VARCHAR(20) NOT NULL,
  -- recebimento
  modo_recebimento         VARCHAR(8) NOT NULL CHECK (modo_recebimento IN ('entrega', 'retirada')),
  cep                      VARCHAR(8),
  endereco                 VARCHAR(200),
  numero                   VARCHAR(20),
  complemento              VARCHAR(100),
  bairro                   VARCHAR(100),
  cidade                   VARCHAR(100),
  estado                   VARCHAR(2),
  referencia               VARCHAR(200),
  tipo_entrega             VARCHAR(6) NOT NULL DEFAULT 'normal' CHECK (tipo_entrega IN ('normal', 'full')),
  entregador_id            INTEGER,
  -- valores
  subtotal                 NUMERIC(10,2) NOT NULL CHECK (subtotal > 0),
  valor_entrega            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_entrega >= 0),
  total                    NUMERIC(10,2) NOT NULL,
  forma_pagamento          VARCHAR(20) NOT NULL DEFAULT 'pix'
                           CHECK (forma_pagamento IN ('pix', 'cartao_entrega', 'dinheiro')),
  -- Pix da loja (cópia gravada no aceite)
  pix_chave                VARCHAR(140),
  pix_tipo                 VARCHAR(10),
  pix_nome_recebedor       VARCHAR(25),
  -- regras
  aviso_idade              BOOLEAN NOT NULL DEFAULT false,   -- Disk Bebidas: conferir idade na entrega
  aceite_automatico        BOOLEAN NOT NULL DEFAULT false,   -- como estava a loja na hora do pedido
  observacao               VARCHAR(500),                     -- recado do cliente
  resposta                 VARCHAR(500),                     -- recado da loja (motivo da recusa/cancelamento)
  encerrado_por            VARCHAR(7) CHECK (encerrado_por IN ('cliente', 'loja', 'sistema')),
  -- link da loja
  token_loja               VARCHAR(40) NOT NULL UNIQUE,
  -- linha do tempo
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- = enviado
  aceito_em                TIMESTAMPTZ,
  pago_saiu_em             TIMESTAMPTZ,
  entregue_em              TIMESTAMPTZ,
  encerrado_em             TIMESTAMPTZ,                          -- entregue/recusado/cancelado/expirado
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loja_pedido_total_ok CHECK (total = subtotal + valor_entrega),
  CONSTRAINT loja_pedido_endereco_ok CHECK (
    modo_recebimento = 'retirada' OR (cep IS NOT NULL AND endereco IS NOT NULL AND numero IS NOT NULL AND bairro IS NOT NULL)),
  CONSTRAINT loja_pedido_beer_ok CHECK (catalogo = 'geral' OR aviso_idade)
);
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_parceiro ON loja_pedidos(parceiro_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_associado ON loja_pedidos(associado_id, created_at DESC);
-- rotina de prazos: só olha pedidos em aberto
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_abertos ON loja_pedidos(status, updated_at)
  WHERE status IN ('enviado', 'aceito', 'pago_saiu');
-- Limite "1 pedido por cliente em cada loja": o índice único fica na 081
-- (uq_loja_pedidos_nao_pago_por_loja, conta só enviado/aceito). Esta
-- migration criava a regra antiga (uq_loja_pedidos_aberto_por_loja, que
-- contava também pago_saiu); como o run.js roda todas as migrations a cada
-- deploy, ela voltava a ser criada e falhava com pedidos reais (cliente com
-- um pedido pago e outro aceito na mesma loja) — deploy do backend quebrado
-- de 06/10 a 07/10. NÃO recriar aqui.

-- Itens: cópia de nome, preço e foto do momento da compra (os produtos
-- estão em tabelas diferentes e podem mudar ou sumir — por isso SET NULL).
-- preco_unitario = o preço EXIBIDO ao cliente na página (regra geral);
-- preco_cheio = preço normal, só pra mostrar o desconto.
-- tipo_preco: normal | associado | fecha_mes | promocao | oferta (Beer).
CREATE TABLE IF NOT EXISTS loja_pedido_itens (
  id                     SERIAL PRIMARY KEY,
  pedido_id              INTEGER NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  origem                 VARCHAR(8) NOT NULL CHECK (origem IN ('produto', 'promocao', 'beer')),
  produto_id             INTEGER REFERENCES sindicato_parceiro_produtos(id) ON DELETE SET NULL,
  promocao_id            INTEGER REFERENCES sindicato_parceiro_promocoes(id) ON DELETE SET NULL,
  fecha_mes_produto_id   INTEGER REFERENCES sindicato_fecha_mes_produtos(id) ON DELETE SET NULL,
  beer_produto_id        INTEGER REFERENCES beer_produtos(id) ON DELETE SET NULL,
  nome                   VARCHAR(200) NOT NULL,
  foto_url               VARCHAR(500),
  tipo_preco             VARCHAR(10) NOT NULL DEFAULT 'normal'
                         CHECK (tipo_preco IN ('normal', 'associado', 'fecha_mes', 'promocao', 'oferta')),
  preco_unitario         NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0),
  preco_cheio            NUMERIC(10,2),
  quantidade             INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 99),
  subtotal               NUMERIC(10,2) NOT NULL,
  CONSTRAINT loja_pedido_item_subtotal_ok CHECK (subtotal = preco_unitario * quantidade)
);
CREATE INDEX IF NOT EXISTS idx_loja_pedido_itens_pedido ON loja_pedido_itens(pedido_id);

-- Avisos de WhatsApp já mandados (rotina de prazos e mudanças de status).
-- O UNIQUE garante "nunca manda duplicado", mesmo com duas execuções ao
-- mesmo tempo (mesmo desenho de carteirinha_avisos). enviado=false = Z-API
-- falhou; a tela mostra o botão manual.
CREATE TABLE IF NOT EXISTS loja_pedido_avisos (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER NOT NULL REFERENCES loja_pedidos(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL,   -- novo, aceito, recusado, pago_saiu, entregue, cancelado, expirado...
  destino     VARCHAR(7) NOT NULL CHECK (destino IN ('cliente', 'loja')),
  enviado     BOOLEAN NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pedido_id, tipo, destino)
);

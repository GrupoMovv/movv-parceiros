-- Loja do Clube MAIS+, partes b1 e b2 (Junior, 19/10/2026).
-- b1: a loja escolhe entrar no Clube e o benefício permanente que oferece aos
--     membros: desconto de 1,5% a 30% (loja toda ou só produtos escolhidos)
--     e/ou entrega grátis. Os mínimos por tipo de loja (3% mercado, farmácia
--     e bebidas; 5% demais produtos; 10% serviços) são só orientação na tela,
--     não trava. A loja sai quando quiser.
-- b2: termo de adesão com versão. Entrar ou mudar o benefício exige o aceite
--     da versão vigente; cada aceite fica guardado (versão, data e hora, IP,
--     navegador, quem aceitou e o benefício aceito). Versão nova publicada:
--     a loja tem 15 dias para aceitar (WhatsApp na publicação e 3 dias antes
--     do prazo); sem aceite, o benefício sai.
-- Nesta etapa o benefício fica só gravado: o preço Clube no site e no pedido
-- entra na b3 (config/clube.js, PRECO_LOJA_CLUBE_NO_SITE).

-- 1. Benefício da loja (uma linha por loja; sair = ativo false, a linha fica)
CREATE TABLE IF NOT EXISTS loja_clube (
  parceiro_id     INTEGER      PRIMARY KEY REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  ativo           BOOLEAN      NOT NULL DEFAULT false,
  percentual      NUMERIC(4,1) CHECK (percentual IS NULL OR (percentual >= 1.5 AND percentual <= 30)),
  alcance         VARCHAR(12)  NOT NULL DEFAULT 'loja' CHECK (alcance IN ('loja', 'escolhidos')),
  entrega_gratis  BOOLEAN      NOT NULL DEFAULT false,
  termo_versao    INTEGER,                      -- versão do último aceite
  entrou_em       TIMESTAMPTZ,                  -- última entrada
  saiu_em         TIMESTAMPTZ,
  motivo_saida    VARCHAR(20)  CHECK (motivo_saida IN ('loja', 'termo_nao_aceito')),
  atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_por  VARCHAR(300),
  -- no Clube sem nenhum benefício não existe
  CONSTRAINT loja_clube_tem_beneficio CHECK (NOT ativo OR percentual IS NOT NULL OR entrega_gratis)
);
CREATE INDEX IF NOT EXISTS idx_loja_clube_ativo ON loja_clube (ativo) WHERE ativo;

-- 2. Produtos escolhidos (alcance 'escolhidos'): catálogo geral ou Disk Bebidas
CREATE TABLE IF NOT EXISTS loja_clube_produtos (
  parceiro_id  INTEGER     NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  catalogo     VARCHAR(8)  NOT NULL CHECK (catalogo IN ('geral', 'beer')),
  item_id      INTEGER     NOT NULL,
  PRIMARY KEY (parceiro_id, catalogo, item_id)
);

-- 3. Termo de adesão, por versão
CREATE TABLE IF NOT EXISTS loja_clube_termos (
  versao            INTEGER      PRIMARY KEY,
  titulo            VARCHAR(300) NOT NULL,
  texto             TEXT         NOT NULL,      -- {{BENEFICIO}} vira o benefício escolhido
  provisoria        BOOLEAN      NOT NULL DEFAULT false,
  prazo_aceite_dias INTEGER      NOT NULL DEFAULT 15,
  publicado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  publicado_por     VARCHAR(300)
);

-- 4. Aceites (histórico: nunca substitui o anterior)
CREATE TABLE IF NOT EXISTS loja_clube_aceites (
  id             SERIAL PRIMARY KEY,
  parceiro_id    INTEGER      NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  versao         INTEGER      NOT NULL REFERENCES loja_clube_termos(versao),
  aceito_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip             VARCHAR(64),
  user_agent     TEXT,
  usuario_id     INTEGER,                       -- sindicato_parceiro_usuarios.id
  usuario_email  VARCHAR(255),
  beneficio      JSONB        NOT NULL,         -- o benefício aceito nesse momento
  texto_aceito   TEXT         NOT NULL          -- o termo como a loja leu, com o benefício preenchido
);
CREATE INDEX IF NOT EXISTS idx_loja_clube_aceites ON loja_clube_aceites (parceiro_id, aceito_em DESC);

-- 5. Entradas, mudanças e saídas (para o admin e para a b4)
CREATE TABLE IF NOT EXISTS loja_clube_eventos (
  id           SERIAL PRIMARY KEY,
  parceiro_id  INTEGER      NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  evento       VARCHAR(20)  NOT NULL CHECK (evento IN ('entrou', 'mudou', 'saiu', 'saiu_prazo')),
  beneficio    JSONB,
  quem         VARCHAR(300),
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loja_clube_eventos ON loja_clube_eventos (parceiro_id, criado_em DESC);

-- 6. Avisos de versão nova do termo (um de cada por loja e versão)
CREATE TABLE IF NOT EXISTS loja_clube_avisos (
  parceiro_id  INTEGER      NOT NULL REFERENCES sindicato_parceiros(id) ON DELETE CASCADE,
  versao       INTEGER      NOT NULL REFERENCES loja_clube_termos(versao),
  tipo         VARCHAR(20)  NOT NULL CHECK (tipo IN ('nova_versao', 'faltam_3_dias', 'saiu_prazo')),
  enviado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ok           BOOLEAN      NOT NULL,
  erro         TEXT,
  PRIMARY KEY (parceiro_id, versao, tipo)
);

-- 7. Versão 1, provisória (as 10 cláusulas do levantamento de 07/10, com os
--    ajustes do Junior de 19/10: empresa "Open Gestão Ltda (nome fantasia:
--    Grupo Movv)"; sem o preço menor do plano, que volta na versão 2 com a
--    parte c; mínimo por tipo só como orientação; 15 dias para nova versão).
INSERT INTO loja_clube_termos (versao, titulo, texto, provisoria, prazo_aceite_dias, publicado_por) VALUES (
  1,
  'Termo de adesão — Loja do Clube MAIS+',
  $termo$Este termo é aceito pela empresa cadastrada no IUB MAIS+ ("Loja"), identificada no painel, ao entrar no Clube MAIS+ ou alterar o benefício oferecido. O IUB MAIS+ é um marketplace operado por Open Gestão Ltda (nome fantasia: Grupo Movv), CNPJ 61.644.671/0001-80 ("IUB MAIS+").

**1. O Clube MAIS+.** O Clube MAIS+ é um programa do IUB MAIS+ que dá preço menor, nas Lojas do Clube, às pessoas que são membros do clube ("Membros").

**2. Benefício oferecido pela Loja.** A Loja se compromete a oferecer aos Membros, enquanto este termo estiver ativo: {{BENEFICIO}}. O percentual de desconto, quando houver, fica entre 1,5% e 30%.

**3. Desconto real.** O desconto é calculado sobre o preço normal, que é o preço praticado no IUB MAIS+ para qualquer cliente naquele momento. A Loja não aumentará o preço normal para compensar o desconto do Clube. O benefício vale igualmente para qualquer Membro, sem distinção.

**4. Promoções.** O desconto do Clube não se soma a promoções nem ao Fecha Mês. O Membro paga sempre o menor preço a que tem direito no momento da compra. A entrega grátis para o Clube, quando oferecida, vale também em pedidos com produtos em promoção.

**5. Selo e vitrine.** Enquanto o benefício estiver ativo, a Loja recebe o selo "Clube" com o benefício oferecido e aparece na vitrine "Lojas do Clube".

**6. Desativar ou reduzir o benefício.** A Loja pode desativar ou reduzir o benefício a qualquer momento pelo painel. Ao desativar, o selo e a vitrine saem na hora.

**7. Histórico de preços.** O IUB MAIS+ registra os preços e as mudanças de preço da Loja e pode conferi-los a qualquer momento. Se identificar aumento do preço normal para compensar o desconto do Clube, o IUB MAIS+ poderá pedir explicação e, depois de ouvir a Loja no prazo de 5 dias úteis, suspender o selo e a vitrine.

**8. Privacidade dos Membros.** A Loja não recebe nem terá acesso a informação sobre como a pessoa se tornou Membro (por exemplo, por vínculo com entidade sindical ou por assinatura), dado que pode ser sensível. A Loja recebe apenas os dados necessários para atender o pedido e não deve pedir ao Membro essa informação.

**9. Alterações deste termo.** O IUB MAIS+ pode atualizar este termo. A versão nova será mostrada no painel e avisada pelo WhatsApp da Loja, e precisará ser aceita em até 15 dias para a Loja continuar no Clube. Sem o novo aceite nesse prazo, o benefício é desativado, com as consequências do item 6.

**10. Registro do aceite.** O aceite é feito no painel e fica registrado com a versão do termo, a data e a hora, o IP, o navegador, o usuário que aceitou e o benefício escolhido.

Versão provisória. Foro, legislação aplicável e demais cláusulas: a definir na revisão jurídica.$termo$,
  true, 15, 'migration 100 (Junior, 19/10/2026)'
) ON CONFLICT (versao) DO NOTHING;

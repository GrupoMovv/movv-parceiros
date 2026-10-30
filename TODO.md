# TODO

## Política de Privacidade: dados dos vendedores da Equipe de vendas — para o advogado (anotado 19/10/2026)

A loja marca, ao cadastrar o vendedor, que ele autorizou o uso do WhatsApp
(data, hora e quem marcou ficam gravados — migration 102). Falta o advogado
revisar e incluir na Política (`/politica-privacidade`) uma frase como:

> "Dados de vendedores das lojas parceiras: quando uma loja cadastra os seus
> vendedores na Equipe de vendas, o IUB MAIS+ guarda o nome e o WhatsApp de
> cada vendedor em nome da loja, que é a responsável por esses dados e declara
> ter a autorização do vendedor. O número é usado só para o aviso de pedidos
> que a loja escolher ligar, e não é mostrado a clientes nem a outras lojas.
> O vendedor pode pedir à loja, ou ao IUB MAIS+, para deixar de receber os
> avisos ou para ter os dados excluídos."

## Pedido pelo site — acabamentos (anotado 19/10/2026, para depois)

- **Barra de pedido com um padrão só.** Hoje a página da loja mostra
  "Ver pedido · N itens" em roxo (`LojaDetalhe.jsx`) e o cardápio do Food
  mostra "Finalizar pedido (N)" em amarelo (`FoodDetalhe.jsx`); no Disk
  Bebidas o pedido aparece só no menu de baixo/topo ("Pedido N"). Escolher um
  texto e uma cor e usar o mesmo componente nas três páginas de loja.
- **"Comprar" nos cards da home, das categorias e da busca.** Detalhe no item
  "PRAZO 30/10/2026" abaixo (lá os cards são de várias lojas: consulta em lote
  `useLojaVendendo`).
- **Corrigir o teste de tela da parte 6 do pedido** (scratchpad
  `tela_parte6.mjs`): falha em dois pontos porque os textos mudaram — a 2ª
  mensagem do aceito agora é o Pix copia e cola (não a chave sozinha) e o
  botão do WhatsApp na página do produto mudou de nome. Falha igual no site
  no ar (conferido em 19/10); não é defeito.

## Chave PIX dos pagamentos antigos — levantar quando o acesso ao banco voltar (anotado 19/10/2026)

Desde a migration 099 (commit 5410294) cada pagamento guarda a chave PIX usada na hora
(`payments.pix_key_usada`, origem `registro`). Os pagamentos antigos ficaram com a chave vazia e o
Histórico mostra "chave usada não registrada". Não preencher nada sem a decisão do Junior.

Levantamento (só leitura, `_tmp_*.js` apagado depois), pagamento por pagamento:
- registrado depois de 09/10/2026 17h14 (início do `partner_pix_historico`, migration 090): chave certa =
  `valor_antes` da primeira troca registrada depois do pagamento, ou a chave atual se não houve troca;
- anterior a 09/10 com troca registrada depois: a chave de 09/10 (`pix_key_origem = 'historico'`),
  que só é a usada se não houve troca entre o pagamento e 09/10 (não ficou registrado);
- anterior a 09/10 sem troca registrada: a chave atual é só suposição (`'suposicao'`) ou fica vazia;
- comprovantes (`pix_receipt`) são a única prova nos antigos: conferência manual.
Mostrar a lista ao Junior; se ele aprovar, gravar numa transação só nos que ele escolher.

Bloqueio em 19/10/2026: a conexão deste computador ao Postgres do Render cai logo no início
("Connection terminated unexpectedly", até `SELECT now()`), com o site e a API funcionando.
Ver o acesso externo do banco no Render (lista de IPs ou senha) antes.

## Trocar o PDF dos convênios do SECI pelo admin (anotado 09/10/2026 — não fazer agora)

Hoje o PDF que "Meus convênios" abre fica no código (`backend/uploads/beneficios/catalogo-beneficios-seci.pdf`):
trocar exige commit e deploy. Fazer um botão no admin (área do Sindicato) para enviar o PDF novo, guardado
fora do código (banco ou Cloudinary), com a rota `/api/public/painel/convenios/pdf` lendo de lá e caindo no
arquivo atual se não houver outro. Esforço: meio dia.

## Push notification para clientes no Premium e no Master (anotado 09/10/2026)

A tela de Planos prometia "Push notification pros clientes (2/mês)" no Premium (Master: 4), mas o site
não envia push hoje (sem chaves VAPID nem inscrição dos navegadores; ver `backend/src/jobs/notificarRoletaDiaria.js`).
O item saiu da tela em 09/10. Os números continuam em `config/planos.js` (`push_por_mes`). Só voltar a
prometer quando o envio existir. A "Integração com Instagram" também saiu: não existe função no sistema.

## IUB Disk Bebidas (/beer) — pendências da fase 1 (2026-09-23)

- **Parecer jurídico sobre cigarros (Lei 9.294/96)** ANTES de intensificar
  marketing dessa categoria. A lei proíbe propaganda de produto fumígeno
  fora do ponto de venda; vitrine online com foto/preço/marca pode ser
  enquadrada. Hoje a categoria `cigarros` existe (só cigarro comum, vape/pod
  bloqueados no filtro), com aviso legal no card — nada de banner, destaque
  em campanha ou push com cigarro até ter o parecer.
- **Fase 2: lista oficial de bairros de Itumbiara** pro "Bairros de entrega"
  do cadastro (hoje é campo livre em `pages/parceiro/Beer.jsx` → texto
  solto em `beer_estabelecimentos.bairros_entrega`; o filtro `?bairro=`
  compara sem acento/maiúscula, mas "Jd. Europa" ≠ "Jardim Europa").
  Com a lista: trocar por multi-select e normalizar o que já existir.
- **Fase 2: avaliações** — por produto e por estabelecimento, média de
  estrelas e comentários. Só implementar quando tiver volume (100+
  pedidos); antes disso uma nota com 2 avaliações engana mais que ajuda.
- **Ordenação "Mais próximo" na tela de categoria** ficou de fora: não
  existe localização do cliente nem do estabelecimento (só bairros de
  entrega em texto livre). Depende da lista oficial de bairros (item acima)
  ou de lat/lng no cadastro + permissão de localização no navegador.
- Roadmap fase 2/3 do spec (combos, "Para quem é?", kits, vitrine premium,
  ofertas dinâmicas, busca inteligente, Monte seu Drink ativo, avaliações)
  — nada implementado.

## IA Assistente de cadastro de produtos — falta ativar e testar com fotos reais

Em 2026-09-15, implementamos o cadastro de produto assistido por IA
(parceiro sobe foto → GPT-4o Vision sugere nome/descrição/marca/
categoria/tags) — ver `backend/src/services/openaiService.js`,
`backend/src/controllers/parceiroIaController.js` e
`frontend/src/components/IACadastroProduto.jsx`, integrado em
`ProdutoForm.jsx`. Migration 050 (tabela `sindicato_ia_uso` + coluna
`sindicato_parceiros.plano_iniciado_em`) já rodou no banco real.

**Falta pra funcionar de verdade**: configurar `OPENAI_API_KEY` (ver
comentário em `backend/.env.example` — platform.openai.com → API keys).
Sem isso, o botão "Cadastrar com IA" sempre volta "IA temporariamente
indisponível" (degrada bem, não quebra nada, só não faz a análise).
Modelo usado é `gpt-4o` com imagem em `detail: "low"` (mais barato);
confira o preço atual em openai.com/api/pricing antes de liberar em
produção — é cobrado por uso, sem plano fixo.

**Falta testar** (não deu pra fazer nesta rodada, sem a chave): rodar
com fotos reais de categorias variadas (farmácia, ótica, beleza,
fitness, personalizados) e conferir se a qualidade da descrição/nome/
categoria sugeridos fica boa o suficiente — pode precisar ajustar o
prompt em `openaiService.js` (`montarPromptSistema`) depois de ver
resultados reais. Os fluxos de erro (sem chave, sem produto
identificado, limite mensal atingido, rate limit) já foram testados ao
vivo contra o banco real e funcionam.

**Como monitorar uso/custo**: não existe dashboard admin pra isso
ainda (deliberadamente fora do escopo desta rodada) — por enquanto dá
pra consultar direto a tabela `sindicato_ia_uso` (tem `parceiro_id`,
`mes_referencia`, `resposta_json`, `data_uso`) pra ver quem mais usa e
quantas análises rodaram por mês.

## Auditar planos comerciais dos parceiros com Roleta ativa

Em 2026-09-14, ativamos a Roleta em massa pra 9 parceiros (academia-atletica,
diroma-fiori, oticas-diniz, ezequiel-nutricionista, plenitude-psicologia,
nesplora-neuropsicologia, laura-clemente-estetica, studio-vip,
imaginari-personalizados) direto via SQL em `sindicato_jogos_parceiros`,
pra dar variedade de prêmios na roleta dos associados.

Problema: todos esses parceiros estão com `plano = 'gratis'` em
`sindicato_parceiros`, mas a regra de negócio em
`backend/src/controllers/parceiroJogosController.js` (`salvarConfig`,
via `limiteJogos(plano)` de `backend/src/config/planos.js`) bloqueia
explicitamente plano grátis de participar dos Joguinhos. O bootstrap
via SQL contornou esse gate de propósito só pra essa ativação inicial.

Precisa: auditar quais desses parceiros realmente estão pagando
mensalidade e corrigir o campo `plano` no banco pra refletir a
realidade — hoje o `plano='gratis'` desses 9 tá desalinhado com o fato
de terem um jogo ativo.

## Adicionar suporte a prêmio não-percentual (beneficio_texto)

`sindicato_jogos_parceiros` (migration `046_sindicato_jogos_roleta.sql`)
só suporta `desconto_percentual` (CHECK > 0 AND <= 100) — não dá pra
configurar um prêmio que não seja desconto, tipo "Consulta grátis",
"Taxa preferencial", "Sobremesa grátis" etc.

Isso bloqueou a ativação da Roleta pro `azul-emprestimo` (parceiro
financeiro, não faz sentido desconto percentual) na rodada de
2026-09-14 — ficou de fora até isso ser resolvido.

Precisa: nova migration adicionando um campo tipo `beneficio_texto`
(TEXT, nullable) em `sindicato_jogos_parceiros`, e decidir a regra de
sorteio/exibição quando o parceiro tiver texto em vez de percentual
(provavelmente `desconto_percentual` vira opcional quando
`beneficio_texto` é preenchido — ver `sortearParceiro`/`girarRoleta`
em `backend/src/services/roletaService.js` e o front que renderiza o
cupom). Depois disso, ativar Roleta pro azul-emprestimo.

## ~~Unificar ParceiroDetalhe.jsx (estático) com as páginas do banco~~ — FEITO

Resolvido em 08-09/10/2026: `/marketplace/parceiro/:slug` virou `LojaDetalhe.jsx`
(banco real, `GET /public/lojas/:slug`, commit d30b573) e o `ParceiroDetalhe.jsx`
estático, que tinha ficado sem rota, foi apagado.

## Itens adiados do redesign Produto vs Serviço (2026-09-14)

Rodada implementou só o núcleo (migration 049, `/marketplace/servicos`,
`/servicos/:slug`, item no menu). Ficaram pra depois, do pedido
original:
- `/marketplace/produtos` (rota nova filtrando tipo_negocio produto/
  hibrido — hoje a home `/marketplace` ainda mistura tudo)
- Seções separadas "Produtos em destaque" / "Serviços em destaque" na
  home
- Filtro Produto/Serviço na página de categoria
  (`/marketplace/categoria/:slug`)
- Campos de tipo_negocio/preço médio/duração/modalidades/horário no
  painel do parceiro (`/parceiro/painel/perfil`) — hoje só dá pra
  editar esses campos direto no banco, sem UI
- Split da busca do TopNav em "N serviços" / "N produtos"
- Página híbrida com abas Produtos/Serviços internas (hoje um parceiro
  híbrido como `diroma-fiori` aparece na listagem de serviços
  normalmente, mas não tem uma página só dele combinando os dois)

## Recupera Carrinho (anotado 05/10/2026 — não fazer agora)

Recurso de **plano pago**. Depende do "Pedido pelo site" (botão Comprar) pronto.
1. **Contador no painel da loja:** quantos clientes têm produtos dela no
   carrinho (`sindicato_associado_carrinho` + localStorage de visitante não
   conta), sem identificar ninguém — só o número.
2. **Oferta com cupom:** botão pra loja mandar oferta com cupom só pra
   clientes que autorizaram receber ofertas (`sindicato_associados.receber_whatsapp`
   ou um opt-in próprio — decidir). Nunca expor quem são os clientes à loja.

## IUB Pet fácil de achar (anotado 05/10/2026 — não fazer agora)

- **Marketplace:** hoje o Pet é só um dos doze ícones de categoria. Avaliar
  um atalho "IUB Pet" na barra de cima, ao lado do IUB Food, e um bloco de
  chamada na página inicial.
- **Painel do cliente (/meu):** hoje o Pet só aparece no menu lateral, que no
  celular fica recolhido. Criar um bloco "Meus Pets" no corpo do painel, no
  estilo do bloco Dependentes: nome, foto, próximo agendamento e atalhos para
  ver a ficha e agendar. Para quem não tem pet, o bloco vira convite para
  cadastrar.

## PRAZO 27/11/2026 (Fecha Mês de novembro): f3, f2, f6 e o card esgotado

Adiado em 30/10/2026 (decisão do Junior): o Fecha Mês de 30/10 rodou com
f1, f4 e f5 no ar. O que fica para 27/11, nesta ordem:

- **f3, "Comprar" nos cards do evento:** cards da vitrine do Fecha Mês com
  Comprar (hoje só o bônus tem; o produto do catálogo tem só "Salvar").
  Também "Tirar dúvida no WhatsApp". Comprar nos cards comuns (fora do
  evento) só depois do evento, como combinado em 20/10.
- **f2, preço do evento em todos os cards:** ver a seção abaixo ("Preço do
  Fecha Mês nos cards").
- **Ajuste do card esgotado (junto com a f2):** no card da vitrine o selo
  "FECHA MÊS" fica cortado pelo selo "-40%" (a 360 px aparece "FECHA I");
  conferir também como o selo "Esgotado" convive com os dois.
- **f6, teste ponta a ponta com data simulada:** do cadastro da loja (prazo
  quinta 18:00) ao pedido no dia (preço do evento, estoque que esgota, preço
  que muda às 23:59:59) e ao lembrete de quinta. Usar os harness do
  scratchpad (servidor_f5.mjs, teste_f5.mjs, teste_so_imaginari.mjs).
- **Avisos de novembro:** a trava de 30/10 (`SO_NESTA_EDICAO` em
  `services/fechaMesAvisos.js`, só a Imaginari e só o lembrete) vale só
  para 2026-10-30. Em 27/11 o convite de segunda e o lembrete de quinta
  voltam a ir para todas as lojas ativas que participam. Decidir antes de
  23/11 se é isso mesmo.
- **Achado em 30/10:** passado o prazo de quinta 18:00, nem a loja nem o
  admin conseguem pôr produto no evento (o admin não tem tela para isso).
  Em 30/10 o evento abriu sem nenhum produto. Decidir se o admin precisa
  de um jeito de incluir produto depois do prazo.

### Preço do evento e "Comprar" nos cards de lista (anotado 05/10/2026)

- **Preço do Fecha Mês nos cards:** hoje, no dia do evento, o preço do Fecha Mês
  aparece só na vitrine do Fecha Mês e na página do produto. Os cards da página
  inicial, das categorias e da busca ainda mostram o preço normal (o pedido
  pelo site já cobra o do evento). Levar `preco_fecha_mes` às consultas de
  listagem (`SELECT_PRODUTO` em `marketplaceHomeController.js`,
  `vitrineRotativaService.js`, busca/categoria) e usar `precoDoProduto` dos cards.
- **"Comprar" nos cards:** FEITO nas páginas de loja (19/10: loja, Food e
  estabelecimento do Disk Bebidas — `BotaoAdicionarCard`, põe no pedido sem
  sair da página, "Comprar"/"+ Adicionar", Salvar vira ícone). FALTA nos cards
  da página inicial, das categorias e da busca (lojas misturadas): lá o botão
  ainda é só "Salvar". Usar a consulta em lote `GET /public/pedidos/lojas?geral=...`
  (`useLojaVendendo`, mesma dos cards do Disk Bebidas) pra não fazer uma
  chamada por card.

## Blindagem do custeio do sindicato (área da carteirinha SECI) — depende de advogado

Pedido do Junior em 07/10/2026. NÃO fazer antes do parecer jurídico. Fica
na área da carteirinha SECI, separado do Clube MAIS+: um não condiciona o
outro (o Clube grátis do sindicalizado continua valendo sem a autorização).

1. **Autorização individual do desconto da contribuição**, na ativação da
   carteirinha, com registro de versão do texto, data, hora e IP, e opção
   de retirar.
   - Viável, mesmo padrão do termo do vendedor PF (`config/vendedorPf.js`
     TERMOS_PF_VERSAO + colunas termos_pf_*), mas numa tabela própria com
     histórico: `contribuicao_autorizacoes` (associado_id, texto_versao,
     aceito_em, ip, user_agent, revogado_em, revogado_ip). Retirar = grava
     revogado_em (nunca apaga). Nova versão do texto = novo aceite.
   - Onde entra no fluxo (todos ativam a carteirinha hoje):
     `contaController.vincularEmpresa` (/meu, CNPJ em dia → tipo_acesso
     'seci'), criação de conta (`contaController` ~:307),
     `publicCadastroController` (/cadastrar) e `cadastrarAssociadoController`
     (cadastro feito pelo Sindicato). Passo opcional e destacado na tela de
     sucesso da ativação; "retirar" em /meu/dados, junto da carteirinha.
   - LGPD: filiação sindical é dado sensível (art. 5º II / art. 11) —
     consentimento específico e destacado; nada disso vai para loja nem
     para o Clube. O texto e a base legal saem do parecer.
   - Falta definir: quem recebe a autorização (o sindicato precisa de
     relatório/exportação para a empresa ou o RH descontar?) e como o
     sindicato é avisado de uma revogação.

2. **Canal de pagamento direto do associado** (Pix automático ou cartão
   recorrente), reaproveitando a cobrança recorrente da assinatura do Clube.
   - Viável depois da parte (d2) do Clube (assinatura R$ 9,90): a mesma
     estrutura de cobrança recorrente (Mercado Pago, como nos planos das
     lojas — `assinaturaService`: preapproval no cartão, Pix com renovação)
     serve para a contribuição, com outro valor e outro "produto".
   - Ponto crítico: o dinheiro é do SINDICATO. Precisa cair na conta do
     sindicato (credenciais Mercado Pago próprias do SECI, ou split), não na
     do Grupo Movv — senão o Grupo recebe e repassa dinheiro do sindicato
     (fiscal/contábil). Confirmar com advogado e contador.
   - Pix Automático (Banco Central, 2025): conferir se o Mercado Pago já
     oferece para esse uso; senão, cartão recorrente + Pix mensal com
     lembrete (como a renovação Pix dos planos).
   - Onde entra: /meu, área da carteirinha ("Pagar minha contribuição"),
     com status, comprovantes e cancelamento; relatório para o Renan.

## Clube MAIS+: contar a economia das compras no balcão (cartão do Clube)

Decisão do Junior (07/10/2026): o contador de economia do Clube conta só
os pedidos pelo site. Fica para depois: registrar o uso no balcão quando a
loja lê o QR do cartão do Clube (loja confirma "compra de R$ X com Y% do
Clube"), para somar no "Você economizou" do membro e no total da loja.
Cuidados: o QR mostra só nome e validade (a loja nunca vê a origem
sindicato/assinatura); evitar registro falso (só usuário logado da loja,
um registro por leitura).

## "IUB Pay": confirmação automática do Pix do pedido (opção da loja) — avaliar

Pedido do Junior em 08/10/2026. NÃO fazer agora. O padrão gratuito continua
sendo o Pix direto na chave da loja com conferência manual ("Pago, saiu").
IUB Pay seria uma opção que a loja liga: o sistema gera o Pix do pedido e
marca "pago" sozinho pelo aviso (webhook) do banco.

1. **Mercado Pago (já integrado nos planos)** — a loja conecta a conta dela
   (OAuth "marketplace"); o sistema cria o Pix do pedido com o token da loja;
   o dinheiro cai na conta Mercado Pago da LOJA; webhook marca pago.
   - Tarifa (out/2026, conferir antes): 0,99% por Pix online, paga pela loja;
     o IUB pode cobrar comissão (marketplace_fee), descontada do valor.
   - A loja precisa: ter conta Mercado Pago e autorizar o app do IUB uma vez.
   - Esforço: ~3 a 4 dias (OAuth e renovação de token por loja, Pix com o
     token da loja, webhook por pagamento, estorno no cancelamento depois do
     pago, tela no painel). Reaproveita o webhook dos planos.
   - Entregador: split no MP Brasil é loja + marketplace (2 partes); pagar o
     entregador direto exigiria outro caminho.
2. **Subcontas (ex.: Asaas)** — o IUB abre uma subconta por loja via API
   (cadastro e documentos da loja), gera a cobrança, recebe o webhook e pode
   dividir o valor (split) com o entregador.
   - Tarifa (out/2026, conferir antes): Pix R$ 0,99 por cobrança nos 3
     primeiros meses e R$ 1,99 depois (valor fixo, bom para pedido grande,
     ruim para pedido pequeno); sem mensalidade.
   - A loja precisa: enviar documentos para a subconta e aceitar os termos da
     instituição; o dinheiro fica na subconta e ela saca para o banco dela.
   - Esforço: ~6 a 8 dias + contrato com a instituição e análise jurídica
     (o IUB passa a orquestrar contas de terceiros; ver a regra "o dinheiro
     não passa pelo IUB").
Comparação de custo por pedido: R$ 30 → MP R$ 0,30 / Asaas R$ 1,99;
R$ 200 → MP R$ 1,98 / Asaas R$ 1,99 (empate perto de R$ 200).

## Livro único de comissões do MOVV Partner (decidido 13/10/2026 — não construir ainda)

Decisões do Junior sobre a proposta de 13/10/2026 (livro `partner_comissoes`,
regras `partner_comissao_regras`, importação `comissao_importacoes` /
`comissao_importacao_linhas`, reaproveitando `products`, `referrals`,
`direta_sales`, `payments` e `admin_acoes`):

1. **Base do percentual = comissão que o Grupo recebeu (`valor_grupo`)**, regra
   do negócio. **Exibição: decidido em 13/10/2026: A, transparência.** A tela e
   a view do Partner mostram, por venda, `base_valor`, `percentual` e
   `valor_partner`, além de produto, cliente, competência, status e se é
   estorno. Ficam fora da view a coluna `valor_grupo`, a `regra_id` e tudo que
   for interno. A aba "Tabela vigente" mostra o percentual do nível do Partner.
   **Por escolha do Junior, o Partner consegue calcular a comissão do Grupo por
   venda** (a `base_valor` é a própria comissão do Grupo, e a diferença para o
   `valor_partner` é o que fica com o Grupo). View:
   ```sql
   CREATE OR REPLACE VIEW v_partner_comissoes_partner AS
   SELECT pc.id, pc.partner_id, pr.name AS produto, pc.cliente_nome,
          pc.competencia, pc.base_valor, pc.percentual, pc.valor_partner,
          pc.status,
          (pc.estorno_de_id IS NOT NULL) AS eh_estorno,
          pc.pago_em, pc.criado_em
   FROM partner_comissoes pc
   JOIN products pr ON pr.id = pc.product_id;
   ```
2. **Federal Invest fica fora da 1ª versão.** A estrutura já aceita a fonte
   (`fonte = 'federal_invest'`) para entrar depois.
3. **Etapas.**
   - Etapa 1: tabela de lançamentos, regras (tabela vigente), tela do Partner
     (`PartnerComissoes.jsx`), aprovação e pagamento no admin (pagamento pela
     tela `/admin/pagamentos`, tabela `payments`) e lançamento automático do
     Certificado (`direta_sales.partner_id`; cancelar/excluir a venda estorna).
   - Etapa 2: importação mensal da planilha da Azul (casar por contrato, depois
     CPF + produto; o que não casar vai para a lista de pendentes). Só começa
     depois que o Junior mandar o arquivo de exemplo.
4. **O lançamento `previsto` nasce na confirmação da venda.**
5. **Urgente e separado:** `GET /api/products` devolve `SELECT *` (inclusive
   `commission_rate` e `percentual_repasse`) para qualquer usuário logado.
   Corrigir para não-admin receber só `id`, `name` e `type`. Atenção:
   `frontend/src/pages/NewReferral.jsx` (tela `/indicar` de contabilidades e
   funcionários) usa `is_active`, `faixa` e `percentual_repasse` dessa rota.

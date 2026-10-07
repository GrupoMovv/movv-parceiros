# TODO

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

## Unificar ParceiroDetalhe.jsx (estático) com as páginas novas de Produtos/Serviços (banco real)

Em 2026-09-14, construí `/marketplace/servicos` + `/servicos/:slug`
(feature de separar Produto de Serviço, `tipo_negocio` em
`sindicato_parceiros`, migration `049`) 100% direto do banco real.

Só que `/marketplace/parceiro/:slug` (`ParceiroDetalhe.jsx`) continua
"Fase 1": lê de um arquivo estático hardcoded
(`frontend/src/pages/public/Marketplace/parceirosData.js`), não do
banco. Esse arquivo só tem 9 dos parceiros reais (falta
`imaginari-personalizados` e `azul-emprestimo`) e nunca teve
`produtos` preenchido — a aba "Produtos" dessa página nunca aparece
pra ninguém. Também mostra "5.0 ⭐" fixo sem sistema de avaliação
nenhum por trás (dado decorativo, não real).

Descobri isso comparando com o banco real: `sindicato_parceiros` já
tem os mesmos campos (whatsapp/descrição/endereço) preenchidos e mais
completos que o arquivo estático — dá pra migrar sem perder nada.

Resultado: hoje existem DOIS sistemas de página de parceiro
coexistindo (estático em `/marketplace/parceiro/:slug`, banco real em
`/servicos/:slug`) — não decidi migrar o antigo porque mexer numa
página que já funciona em produção não estava no escopo pedido.
Precisa: migrar `ParceiroDetalhe.jsx` pro banco de verdade (reusar os
endpoints de `marketplaceHomeController.js` como referência) e tirar o
"5.0 fixo", ou decidir formalmente manter os dois por algum motivo.

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

## PRAZO 30/10/2026 (próximo Fecha Mês): preço do evento e "Comprar" nos cards de lista

Anotado 05/10/2026. Tem que estar no ar ANTES do Fecha Mês de 30/10 (última sexta do mês).

- **Preço do Fecha Mês nos cards:** hoje, no dia do evento, o preço do Fecha Mês
  aparece só na vitrine do Fecha Mês e na página do produto. Os cards da página
  inicial, das categorias e da busca ainda mostram o preço normal (o pedido
  pelo site já cobra o do evento). Levar `preco_fecha_mes` às consultas de
  listagem (`SELECT_PRODUTO` em `marketplaceHomeController.js`,
  `vitrineRotativaService.js`, busca/categoria) e usar `precoDoProduto` dos cards.
- **"Comprar · R$ X" nos cards:** nos mesmos cards o único botão hoje é
  "Salvar". Para loja que vende pelo site agora, o botão do card vira
  "Comprar · R$ X" (põe no pedido e abre o Finalizar) e o Salvar vira ícone
  pequeno. Usar a consulta em lote `GET /public/pedidos/lojas?geral=...`
  (mesma dos cards do Disk Bebidas) pra não fazer uma chamada por card.

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

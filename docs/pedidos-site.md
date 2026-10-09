# Pedido pelo site (botão Comprar) — IUB MAIS+

Resumo do projeto para consulta. Atualizado em 09/10/2026: partes 1 a 9 no ar, domínio iubmais.com.br no ar, falta a parte 10 (teste ponta a ponta e liberação).

## Escopo (versão 1)

- Botão **Comprar** ao lado do **Chamar no WhatsApp**, que continua igual.
- **O dinheiro não passa pelo IUB.** O cliente paga direto no Pix da loja; o IUB só registra e acompanha o pedido. Sem Mercado Pago e sem split nesta versão.
- **A loja liga o recurso** no painel ("Pedidos pelo site", desligado por padrão): chave Pix, aceite automático (sim/não) e pausa rápida.
- **Botão Comprar** só aparece se a loja ligou, está aberta e não pausou. Não aparece para serviços, vendedor pessoa física ou produto sem preço.
- **Finalizar pedido** (cliente logado, WhatsApp confirmado): quantidade, entrega ou retirada, endereço do cadastro ou novo (CEP via ViaCEP), Pix, resumo (produtos + taxa = total), "Enviar pedido". Um pedido = uma loja.
- **Status:** `enviado → aceito → pago_saiu → entregue`, mais `recusado`, `cancelado` e `expirado`.
- **Lado da loja** (no máximo 2 toques): aviso no WhatsApp (Z-API, com fallback manual) e link que abre o pedido sem login (token por pedido, com validade). Toque 1: Aceitar/Recusar (pulado no aceite automático). Toque 2: "Pago, saiu para entrega". Aba Pedidos no painel: Para responder / Em andamento / Encerrados.
- **Lado do cliente:** depois do aceite vê a chave Pix e o total; acompanha em `/meu`; recebe aviso no WhatsApp a cada mudança.
- **Prazos:** loja sem resposta em 10 min → expira, cliente avisado e com botão para chamar a loja. "Entregue" fecha sozinho depois de "saiu" ou quando o cliente confirma.
- **Regras que não podem quebrar:** Disk Bebidas com verificação +18 e aviso de conferência de idade na entrega; preço de associado para quem tem direito; o item do pedido guarda nome, preço e foto do momento da compra.
- **Fora da V1** (tabela já preparada): Entrega Full, cadastro de entregadores, cartão na porta, split. Colunas `tipo_entrega` (normal/full), `valor_entrega`, `entregador_id` (nulo) e `forma_pagamento` já existem.

## As 15 decisões (Junior, 05/10/2026)

1. Vários itens da mesma loja no pedido, com "Adicionar mais desta loja".
2. Loja sem horário cadastrado **não** liga o recurso, seja qual for o tipo. Ao ligar, ela confirma horário, entrega/retirada e taxa (os padrões da migration 051 não valem).
3. V1 só para lojas do tipo **produto** e para o **Disk Bebidas**. Loja híbrida e de serviço ficam só com WhatsApp.
4. A tela de configuração aparece para qualquer loja, com textos neutros. Taxa de entrega sempre da loja. No pedido do Beer, retirada, bairros e aberto/fechado vêm do estabelecimento Beer.
5. Sem bloqueio por área na V1: mostra ao cliente a área ou os bairros informados, e a loja recusa se for fora.
6. Endereço do cadastro ou endereço novo salvo só no pedido, com os últimos usados como sugestão. Inclui complemento e ponto de referência. Sem tabela de endereços.
7. Retirada usa o mesmo status `pago_saiu`, com o texto "Pago, pode retirar". Entregue automático: **3h** na entrega, **12h** na retirada.
8. Aceito e sem "pago" em **2 horas**: cancela sozinho e avisa os dois lados.
9. Cliente cancela sozinho só enquanto o pedido está "enviado". Depois do aceite, vê "Chamar a loja" e negocia pelo WhatsApp. Só a loja cancela depois disso (no link e no painel).
10. Link da loja vale até o pedido encerrar + 24h.
11. QR Pix e copia-e-cola com o valor, feito depois da parte 8.
12. Qualquer plano pode usar, inclusive o Grátis.
13. Fecha Mês e promoção entram já na V1 (produto em promoção tem botão Comprar).
14. Prazos por timer dentro do backend (Render plano Starter, sempre ligado), com rota interna pronta para Cron.
15. No máximo 3 pedidos por cliente e 1 por loja (ajustado depois: só os não pagos, ver abaixo).

## Ajustes decididos depois

- **Teste com as lojas de teste (`empresa_teste`, ver "Lojas de teste" abaixo):** só compra em **modo QA**. O servidor recusa pedido para elas fora do modo QA. Modo QA = admin logado (login no cabeçalho `x-admin-token`, porque o `Authorization` já leva a sessão do cliente) **ou** conta de cliente marcada como **testador** (desde 09/10: o admin liga em /admin/testadores por 30 dias, com registro de quem ligou; o site manda o cabeçalho `x-cliente-token` e mostra o aviso "Modo teste").
- **A mensagem de aceite** que vai para o WhatsApp do cliente já leva o total e a chave Pix, para o fluxo funcionar ao fim da parte 6, antes do `/meu/pedidos`.
- **Política de Privacidade e termos** entram na parte 10: o pedido passa nome, telefone e endereço do cliente para a loja; o IUB não é parte da venda; o pagamento é direto para a loja.
- **Preço:** o pedido cobra o **menor preço a que o cliente tem direito naquele momento** (normal, associado com benefício ativo, Fecha Mês no dia do evento, promoção, oferta do Beer). Descontos não acumulam. O resumo do Finalizar mostra esse preço, calculado pelo servidor, e o pedido cobra exatamente o valor do resumo.
- **Exibição (parte 6):**
  - o preço principal de qualquer card ou página é o que **aquela pessoa** paga agora (mesma função do servidor);
  - **não** esconder o preço de membro do visitante: o preço normal é o principal e o de membro aparece como chamada secundária ("R$ X no Clube MAIS+", antes "para associado SECI"), com link para o /clube;
  - Fecha Mês aparece na página do produto no dia do evento;
  - a página da promoção mostra o menor preço para o associado.
- **Fecha Mês:** o preço do evento vale para todo mundo, visitante e associado. Não existe preço de Fecha Mês só para associado (conferido no código: a tabela só tem `preco_original` e `preco_fecha_mes`). Se o produto também tem preço de associado menor, o associado paga o menor.
- **Promoção com limite de vagas:** 1 vaga por pedido, reservada quando o pedido é criado e devolvida se for recusado, expirado ou cancelado. É a mesma "vaga" que o clique no WhatsApp da promoção já conta.
- **Promoção: 1 unidade por pedido.** A promoção não tem limite próprio por pedido.
- **Limite de pedidos:** conta só os **não pagos** (`enviado` e `aceito`). Depois de "pago, saiu", o cliente pode fazer outro pedido na mesma loja.
- **Trava de lançamento:** até `PEDIDOS_SITE_LIBERADO=true` no Render, só a empresa de teste consegue ligar o recurso, e a aba nem aparece para as outras lojas.
- **Fora de escopo, anotado no TODO.md:** "Recupera Carrinho" (contador para a loja e oferta com cupom para quem autorizou; plano pago).
- **Avisos (parte 5), poucas mensagens para não arriscar o chip do Z-API:**
  - loja: "novo pedido", com o link sem login, e **um** lembrete se o pedido aceito ficar 30 min sem "pago" ("confira o Pix ou cancele", com o horário em que o sistema cancela). Decidido em 06/10: evita cancelar em 2h o pedido de quem pagou e a loja esqueceu de marcar;
  - cliente: aceito (total + Pix), recusado, expirado, cancelado (pela loja ou pelo sistema), "saiu para entrega" ou "pronto para retirar". Não avisa "entregue" nem quando o próprio cliente cancela;
  - no aceito, a chave Pix vai **sozinha numa segunda mensagem**, para copiar com um toque. O texto pede para conferir o nome antes de pagar e diz que a loja só prepara depois de confirmar o Pix;
  - pedido do Disk Bebidas avisa o WhatsApp do **estabelecimento Beer**;
  - o link com token da loja **nunca** vai para o cliente. Se o Z-API falhar ao avisar a loja, o cliente ganha um botão manual só com o número do pedido;
  - ativação: passo "salve o número do IUB MAIS+ nos contatos" (número em `ZAPI_NUMERO_EXIBICAO`, no Render) e botão "Enviar aviso de teste".
- **Link da loja:** depois de "Pago, saiu", botão "Enviar para o entregador" com nome, telefone, endereço completo, itens e total (já pago), **sem** o link do pedido.
- **Número do pedido começa em 1001** (migration 082).
- **Links das mensagens** usam a variável `FRONTEND_URL` (desde 08/10: https://iubmais.com.br).
- **Não marcar como confirmado** o WhatsApp de quem usou o "esqueci a senha": aquele fluxo não guarda para qual número o código foi.
- **Promoção "Só Clube"** (antes "exclusiva para associado"): o servidor recusa no pedido (403 `SO_ASSOCIADO`) para quem não tem o benefício ativo, e o botão Comprar some (07/10). A mensagem diz "Esta promoção é só para quem é do Clube MAIS+".
- **"Mais Vendidos" da home** (08/10): conta os pedidos pagos ou entregues dos últimos 30 dias, sem loja de teste e sem Disk Bebidas. Enquanto houver menos de 4 produtos vendidos, a lista usa os cliques no WhatsApp dos últimos 7 dias e o título vira "Mais procurados" (aprovado pelo Junior em 09/10).
- **Mensagem do aceito** leva também o Pix copia e cola com o valor (08/10). Os avisos de WhatsApp têm o botão "Trocar número" (08/10).

## O que cada parte entregou

| Parte | O que entrou | Situação |
|---|---|---|
| 1. Migration 080 | Colunas da loja (ligar, pausar, aceite automático, confirmação, Pix), WhatsApp confirmado do cliente, tabelas `whatsapp_codigos`, `loja_pedidos`, `loja_pedido_itens`, `loja_pedido_avisos` | No ar (`7c8628d`), conferida em produção |
| 2. WhatsApp confirmado | Código de 6 números pelo Z-API (10 min, 1 por minuto, 3 por hora, 5 tentativas). Confirmado = número verificado igual ao atual. Bloco em Meus Dados | No ar (`09be737`). Falta o Junior testar com o Z-API real |
| 3. Núcleo no backend | `services/pedidoLoja.js`: regra única de "pode comprar", preço no servidor, cotação, criação com cópia dos itens, +18 do Beer no servidor, limites, mudanças de status atômicas, reserva de vaga de promoção. Rotas do cliente em `/api/public/pedidos` | No ar (`3ddccf3`, `3f1467b`) |
| 4. Configuração da loja | Aba "Pedidos pelo site": Pix validado, aceite automático, pausa, confirmação da configuração. Aba "Entrega e horários" para toda empresa. Trava `PEDIDOS_SITE_LIBERADO` | No ar (`25b09d5`) |
| Ajustes | Migration 081 (limite só de não pagos) e promoção com 1 unidade por pedido | No ar (`ddded99`) |
| 5. Avisos e link da loja | Textos em `services/pedidoMensagens.js` (aprovados pelo Junior), envio e registro em `services/pedidoAvisos.js` (cada aviso uma vez só), página `/pedido-loja/:token` (Aceitar/Recusar, Pago saiu, Cancelar, Enviar para o entregador), botão de aviso de teste no painel, migration 082 (#1001) | No ar (`5143a96`, `412171f`) |
| 6a. Comprar e Finalizar | Botão Comprar (produto, promoção, Fecha Mês, Beer, Food), sacola, Finalizar com WhatsApp confirmado, endereço e +18; "Minha lista" (antigo carrinho) | No ar |
| 6b. Preço por pessoa | O preço principal de cada card e página é o que aquela pessoa paga (`precoPessoa.js`, mesma regra do servidor); selo "-X% Clube" (era "-X% SECI") | No ar |
| 7. Aba Pedidos no painel | Para responder / Em andamento / Encerrados, contador, som e "(n) Novo pedido" no título | No ar (`218ffa6`, `6e709d6`) |
| 8. `/meu/pedidos` | Lista e acompanhamento, Pix, "Recebi meu pedido", cancelar enquanto a loja não aceitou, "Chamar a loja" | No ar (`9af4f68`) |
| QR Pix | Copia e cola e QR com o valor (BR Code do Banco Central, `utils/pixBrCode.js`), só enquanto o pedido está aceito | No ar |
| 9. Prazos | `services/pedidoPrazos.js`: timer no servidor a cada minuto + `POST /api/interno/pedidos/prazos` (reserva, com `CRON_SECRET`). `PEDIDOS_PRAZOS_TIMER=false` desliga o timer. Linha "[prazos pedidos] timer ligado" nos logs a cada start | No ar |
| Lembrete do Pix | Um lembrete para a loja aos 30 min de aceito sem "pago" (texto aprovado) | No ar (`8ca443c`, `dca319a`) |
| Migrations | `migrations/run.js` registra o que já rodou em `schema_migrations` e roda só as novas (o build do movv-backend roda o run.js) | No ar (`64af049`) |
| Domínio | iubmais.com.br e api.iubmais.com.br (ver "Domínio oficial") | No ar (08/10) |
| Testador | Conta de cliente em modo QA por 30 dias (migration 086, /admin/testadores) | No ar (09/10, `fc58f45`) |

## O que falta

| Parte | O que vai entrar |
|---|---|
| 10. Teste ponta a ponta | Teste com as lojas de teste em modo QA (admin ou testador), Política de Privacidade e termos atualizados (razão social do cartão CNPJ + "nome fantasia: Grupo Movv"), limpeza dos pedidos de teste (`node scripts/lojas_teste_limpar.js`, numeração volta para 1001) e depois `PEDIDOS_SITE_LIBERADO=true` no Render. Raiz, marca e troca das variáveis do domínio já foram feitas |

## Lojas de teste e lojas pausadas (09/10/2026)

- **Lojas de teste** (`empresa_teste`, só aparecem e só compram em modo QA): 47 Adega Teste IUB, 49 Pet Teste, 50 Serviço Teste, 51 Mercado Teste (pausadas) e 18 Burguer Teste (ativa, marcada como teste em 08/10). Pedido de loja de teste não conta no "Mais Vendidos".
- **Pausadas** (não aparecem no site): 1 a 9, as contas automáticas dos convênios do SECI (decisão de 09/10: continuam pausadas; se alguma entrar, entra como loja normal), 15 Azul Empréstimo (Premium de cortesia) e 16 Gêmeos Moda Masculina.
- **Única loja pública hoje:** 14 Imaginari Personalizados, em **Master de cortesia** desde 09/10 (para a vitrine "Produtos em Destaque" voltar à home).
- Detalhes do Clube MAIS+ e dos convênios em `docs/clube-mais.md`.

## Domínio oficial (antes de ligar `PEDIDOS_SITE_LIBERADO`)

**FEITO em 08/10/2026:** FRONTEND_URL=https://iubmais.com.br e BACKEND_URL=https://api.iubmais.com.br (movv-backend), VITE_API_URL=https://api.iubmais.com.br/api (movv-parceiros). Conferido: site chama só api.iubmais.com.br, sem erro de CORS; links e prévias saem com o domínio novo; endereços fixos no código trocados (5c4d19a). Webhook do Mercado Pago segue no endereço antigo (funciona; trocar é opcional).

Decisão do Junior (05/10/2026): ir direto para **iubmais.com.br**, sem passar por portal.grupomovv.com.br. Mensagem pedindo Pix com link `onrender.com` parece golpe.

- **Site:** `iubmais.com.br` e `www.iubmais.com.br` → site estático `movv-parceiros` no Render.
- **API:** `api.iubmais.com.br` → web service `movv-backend` no Render (o link da carteirinha para de sair como `onrender.com`).
- **Os endereços antigos continuam funcionando para sempre:** `movv-parceiros.onrender.com`, `movv-backend.onrender.com` e `portal.grupomovv.com.br`. Há links e QR codes já enviados com eles. Não remover o domínio portal do Render.

**Ordem:**
1. Agora: domínio no Render + registros no DNS do Registro.br (a zona usa `e.sec.dns.br`/`f.sec.dns.br`, sem ALIAS no domínio raiz; publicado e com HTTPS em 05/10):

   | Tipo | Nome | Valor |
   |---|---|---|
   | A | `iubmais.com.br` (raiz) | `216.24.57.1` |
   | CNAME | `www` | `movv-parceiros.onrender.com` |
   | CNAME | `api` | `movv-backend.onrender.com` |

   Sem registro AAAA (o Render só usa IPv4). Se houver CAA, liberar Let's Encrypt e Google Trust Services. O Render emite o certificado sozinho depois de verificar.
2. CORS já aceita `https://iubmais.com.br` e `https://www.iubmais.com.br` (commit `3e9051a`), sem tirar os antigos.
3. **Raiz e marca do domínio (antes da troca das variáveis):** hoje `iubmais.com.br/` cai no login do portal interno ("Movv Parceiros"), porque a rota `/` do `App.jsx` é do portal (`RequireAuth`).
   - no `iubmais.com.br` (e `www`), a raiz leva para `/marketplace`; quem já está logado no portal da equipe continua indo para o painel de sempre (o login manda para `/` depois de entrar);
   - no `portal.grupomovv.com.br` e no `onrender.com`, nada muda;
   - `/login` continua existindo nos dois domínios, para a equipe;
   - prévia de link: `og:image` do `index.html` passa a usar `https://iubmais.com.br/iub-logo-og.png` (já responde 200). Título da aba, `og:title` e ícone já são do IUB.
4. **Depois do teste real com a Adega e antes de ligar a trava** (variáveis no Render, sem código):
   - backend: `FRONTEND_URL=https://iubmais.com.br` e `BACKEND_URL=https://api.iubmais.com.br`;
   - site estático: `VITE_API_URL=https://api.iubmais.com.br/api` (exige novo build do site).
5. Junto com o passo 4, trocar o que está escrito fixo no código: link `portal.grupomovv.com.br/entrar` na mensagem de aprovação do /vender (`parceiroSolicitacaoController.js`), `MaterialApoio.jsx`, `MyEmployees.jsx` e a imagem de prévia do `index.html`.

**O que a troca de `FRONTEND_URL` muda:** links das mensagens do pedido, avisos do Pet e da carteirinha, lembrete de assinatura e retorno do Mercado Pago, uns 20 links de e-mail (senha, confirmação, planos), o redirecionamento de `/carteirinha/:hash` e `/produto/:id` e a imagem de prévia. **`BACKEND_URL`** muda o link da carteirinha nas mensagens de WhatsApp (produto, promoção, carrinho) e nos e-mails de dependente.

**Efeito no cliente:** o navegador guarda login e sacola por domínio. Quem usa o site pelo endereço antigo precisa entrar de novo no domínio novo (a sacola não passa junto).

## Como testar

- Sem banco de staging: os testes rodam num **banco descartável** (PGlite com todas as migrations) e no app real do backend, com o Z-API só gravando as mensagens. Nunca no banco de produção.
- Telas: build do site com `VITE_API_URL=http://127.0.0.1:3999/api` servido na porta 5173 (a única que o CORS aceita), contra o backend real ligado ao banco descartável; fotos no Edge a 390 px. Antes de todo push de site, a rotina dos menus no celular (360 px).

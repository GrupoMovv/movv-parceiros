# Pedido pelo site (botão Comprar) — IUB MAIS+

Resumo do projeto para consulta. Atualizado em 05/10/2026.

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

- **Teste com a Adega Teste IUB (parceiro 47, `empresa_teste`):** só compra em **modo QA** (admin logado). O servidor recusa pedido para ela fora do modo QA. Como o `Authorization` já leva a sessão do cliente, o login do admin vai no cabeçalho `x-admin-token`.
- **A mensagem de aceite** que vai para o WhatsApp do cliente já leva o total e a chave Pix, para o fluxo funcionar ao fim da parte 6, antes do `/meu/pedidos`.
- **Política de Privacidade e termos** entram na parte 10: o pedido passa nome, telefone e endereço do cliente para a loja; o IUB não é parte da venda; o pagamento é direto para a loja.
- **Preço:** o pedido cobra o **menor preço a que o cliente tem direito naquele momento** (normal, associado com benefício ativo, Fecha Mês no dia do evento, promoção, oferta do Beer). Descontos não acumulam. O resumo do Finalizar mostra esse preço, calculado pelo servidor, e o pedido cobra exatamente o valor do resumo.
- **Exibição (parte 6):**
  - o preço principal de qualquer card ou página é o que **aquela pessoa** paga agora (mesma função do servidor);
  - **não** esconder o preço de associado do visitante: o preço normal é o principal e o de associado aparece como chamada secundária ("R$ X para associado SECI"), com link para fazer a carteirinha;
  - Fecha Mês aparece na página do produto no dia do evento;
  - a página da promoção mostra o menor preço para o associado.
- **Fecha Mês:** o preço do evento vale para todo mundo, visitante e associado. Não existe preço de Fecha Mês só para associado (conferido no código: a tabela só tem `preco_original` e `preco_fecha_mes`). Se o produto também tem preço de associado menor, o associado paga o menor.
- **Promoção com limite de vagas:** 1 vaga por pedido, reservada quando o pedido é criado e devolvida se for recusado, expirado ou cancelado. É a mesma "vaga" que o clique no WhatsApp da promoção já conta.
- **Promoção: 1 unidade por pedido.** A promoção não tem limite próprio por pedido.
- **Limite de pedidos:** conta só os **não pagos** (`enviado` e `aceito`). Depois de "pago, saiu", o cliente pode fazer outro pedido na mesma loja.
- **Trava de lançamento:** até `PEDIDOS_SITE_LIBERADO=true` no Render, só a empresa de teste consegue ligar o recurso, e a aba nem aparece para as outras lojas.
- **Fora de escopo, anotado no TODO.md:** "Recupera Carrinho" (contador para a loja e oferta com cupom para quem autorizou; plano pago).
- **Não marcar como confirmado** o WhatsApp de quem usou o "esqueci a senha": aquele fluxo não guarda para qual número o código foi.

## O que cada parte entregou

| Parte | O que entrou | Situação |
|---|---|---|
| 1. Migration 080 | Colunas da loja (ligar, pausar, aceite automático, confirmação, Pix), WhatsApp confirmado do cliente, tabelas `whatsapp_codigos`, `loja_pedidos`, `loja_pedido_itens`, `loja_pedido_avisos` | No ar (`7c8628d`), conferida em produção |
| 2. WhatsApp confirmado | Código de 6 números pelo Z-API (10 min, 1 por minuto, 3 por hora, 5 tentativas). Confirmado = número verificado igual ao atual. Bloco em Meus Dados | No ar (`09be737`). Falta o Junior testar com o Z-API real |
| 3. Núcleo no backend | `services/pedidoLoja.js`: regra única de "pode comprar", preço no servidor, cotação, criação com cópia dos itens, +18 do Beer no servidor, limites, mudanças de status atômicas, reserva de vaga de promoção. Rotas do cliente em `/api/public/pedidos` | No ar (`3ddccf3`, `3f1467b`) |
| 4. Configuração da loja | Aba "Pedidos pelo site": Pix validado, aceite automático, pausa, confirmação da configuração. Aba "Entrega e horários" para toda empresa. Trava `PEDIDOS_SITE_LIBERADO` | No ar (`25b09d5`) |
| Ajustes | Migration 081 (limite só de não pagos) e promoção com 1 unidade por pedido | Commit local (`ddded99`), aguardando push |

## O que falta

| Parte | O que vai entrar |
|---|---|
| 5. Avisos e link da loja | Aviso pelo Z-API para a loja e para o cliente a cada mudança, com fallback manual. Página pública do pedido pelo token (Aceitar/Recusar, "Pago, saiu", Cancelar) |
| 6. Comprar e Finalizar | Botão Comprar nas páginas (produto, promoção, Fecha Mês, Beer), tela de finalizar com WhatsApp confirmado, endereço e +18, e os preços das páginas alinhados com a regra do servidor |
| 7. Aba Pedidos no painel | Para responder / Em andamento / Encerrados, com contador |
| 8. `/meu/pedidos` | Acompanhar, ver Pix e total, "Recebi", "Chamar a loja" |
| QR Pix | QR e copia-e-cola com o valor (padrão do Banco Central, sem Mercado Pago) |
| 9. Prazos | Timer no backend + `/api/interno` para Cron: expira em 10 min, cancela aceito sem pago em 2h, fecha entregue em 3h/12h, avisos sem duplicar |
| 10. Teste ponta a ponta | Com a Adega Teste em modo QA, Política de Privacidade e termos atualizados, e depois `PEDIDOS_SITE_LIBERADO=true` |

## Como testar

- Sem banco de staging: os testes rodam num **banco descartável** (PGlite com todas as migrations) e no app real do backend, com o Z-API só gravando as mensagens. Nunca no banco de produção.
- Telas: Vite com `VITE_API_URL=/api` e as respostas da API simuladas no navegador (Edge em 390 px).

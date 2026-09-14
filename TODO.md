# TODO

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

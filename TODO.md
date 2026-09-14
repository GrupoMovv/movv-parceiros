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

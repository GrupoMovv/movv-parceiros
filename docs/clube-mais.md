# Clube MAIS+ — IUB MAIS+

Resumo do projeto para consulta. Atualizado em 09/10/2026.
Levantamento e plano original (07/10): https://claude.ai/artifact/798GsBU5sbLftsazmduvpV

## O que é

**Clube MAIS+** é o nome público do desconto de membro no IUB MAIS+. Quem é do Clube paga o "preço Clube" nas lojas que oferecem. São duas portas de entrada:

- **Trabalhador do comércio associado ao SECI:** entra de graça (regra de hoje em `backend/src/services/beneficioAssociado.js`: conta SECI, carteirinha na validade e empresa em dia na Base SECI).
- **Assinatura de R$ 9,90 por mês:** "Em breve", com lista de interessados.

A loja nunca sabe por qual porta o cliente entrou. Filiação a sindicato é dado pessoal sensível (LGPD, art. 5º, II).

## Decisões do Junior

| Data | Decisão |
|---|---|
| 07/10 | Nome "Clube MAIS+". Percentual permanente do Clube de 1,5% a 30%; queima de estoque continua em Promoções e Fecha Mês. Termo de adesão da Loja do Clube com aceite registrado (texto para o advogado no levantamento). |
| 08/10 | **O nome SECI fica só na área da carteirinha e em "Meus convênios".** No resto do site, o desconto é "Clube" ou "preço Clube". |
| 08/10 | Planos sem preço SECI até existir a regra de Loja do Clube (opção B, `PRECO_LOJA_CLUBE_ATIVO = false`): todo mundo paga o preço normal, com a faixa "Em breve: Lojas do Clube MAIS+ vão pagar menos". Loja em cortesia não vê a faixa (não paga). |
| 08/10 | Assinatura de R$ 9,90 aparece como "Em breve", sem prometer prazo. "Meu Painel SECI" vira "Meu Painel". |
| 08/10 | Promoção "Só Clube" travada de verdade no pedido (403 `SO_ASSOCIADO`). |
| 09/10 | "Mais Vendidos" com venda real; enquanto não há venda, "Mais procurados" (cliques). |
| 09/10 | **Convênios do SECI:** as 9 empresas não aparecem mais como benefício do sindicato no marketplace. Se entrarem, é como loja normal, para todos, sem selo nem menção ao SECI. O convênio fica só na área da carteirinha e **a fonte é o PDF**: "Meus convênios" mostra só o botão do catálogo em PDF, com login. A tabela `seci_convenios` fica no banco, sem ser exibida. |
| 09/10 | O nome certo é **"Drogaria Sindical"**, não "Nossa Drogaria" (migration 087). |
| 09/10 | Imaginari Personalizados (14) em **Master de cortesia**, para a vitrine "Produtos em Destaque" voltar à home. |
| 09/10 | A página antiga `ParceiroDetalhe.jsx` (sem rota, com "Exclusivo associado") foi apagada. |
| 09/10 | Sobras do convênio: Favoritos só com lojas reais do banco; Memória com símbolos de categoria no lugar das 9 empresas (fica a Imaginari); sai o campo "Benefício associado" do painel (o dado fica no banco); "IUB MAIS+" com o "+" em todo o site, e-mails e WhatsApp. Cupons 20 e 21 (conta 144, do Junior) invalidados; 22 e 23, de clientes reais, ficaram. |
| 09/10 | Só promessa comprovável: "Comece grátis" e "O plano Grátis não tem mensalidade. Os planos pagos são opcionais."; topo do /vender "O marketplace de Itumbiara. Simples e direto no WhatsApp."; sem push e sem Instagram nos planos (não existem; TODO.md); Roleta sem "milhares de clientes"; Pioneiro "20 vagas" enquanto ninguém entrou. Live, Post no Instagram, Boost e eventos: decisão do Junior. |
| 09/10 | Portal Movv com mais de um admin: registro de quem aprovou, cancelou, voltou e pagou (migration 088); senha de admin só o dono troca; só o ADMIN-001 cria admin; servidor bloqueia tudo até trocar a senha provisória. Perfil **financeiro** (migration 089) para a ADMIN-002 do Edmar: só parceiros, indicações, comissões, pagamentos, comissões internas, indicadores e Movv Certificado; sem Sindicato, sem verificação de pessoa física, sem modo de teste e sem trocar senha de ninguém. |
| — | IUB Pay (confirmação automática do Pix do pedido): decidir depois do piloto (TODO.md). |

## O que está no ar

| Parte | O que entrou | Situação |
|---|---|---|
| a1. Visitante e mensagens | Cards, produto, promoção, home, menu, faixa, rodapé, prévia de link, manifesto, Finalizar e tour falam em "Clube MAIS+" e "preço Clube". Página `/clube`. Mensagens do cliente para a loja dizem "Sou do Clube MAIS+" e mandam o **cartão do Clube** (`/clube/:hash`: só nome, situação e validade) | No ar (`a81bcae`) |
| a2 (parte 1). Painel da loja | Cadastro de produto e promoção ("Preço Clube", "Só Clube"), Jogos, Fecha Mês, Promoções e itens de plano sem "Sindicato" | No ar (`3fd3e8b`) |
| Opção B dos planos | `PRECO_LOJA_CLUBE_ATIVO = false`: sem verificação de CNPJ, sem "Sou sindicalizada SECI". Valores menores (34,90 / 49,90 / 97,90) guardados para a parte (c) | No ar (`ef24040`) |
| b0. Histórico de preços | Migration 083: `precos_historico` com gatilhos em produtos e no Beer | No ar (`b9a8d22`) |
| d1. "Em breve" e interessados | `/clube` com "Quero ser avisado" (nome, WhatsApp, autorização) → `clube_interessados` (migration 084) | No ar (`f2a6e4c`) |
| Ajustes do teste de 08/10 | Selo "-X% Clube" só com o desconto que a pessoa tem, "IUB MAIS+" com o "+", vitrine sem loja pausada | No ar (`f2a6e4c`) |
| e. Convênios do SECI | Fora do marketplace público; `/meu/convenios` só para conta SECI, PDF servido com login; link público antigo do PDF redireciona para `/meu/convenios` (migration 085) | No ar (`867b17a`) |
| Página da loja | `/marketplace/parceiro/:slug` do banco (`GET /public/lojas/:slug`); loja pausada ou de teste dá "Loja não encontrada" para visitante | No ar (`d30b573`, push 09/10) |
| "Em breve" e "Meu Painel" | `/clube` sem prometer prazo; cabeçalho do /meu sem SECI | No ar (`8355b12`, push 09/10) |
| Testador | Conta de cliente em modo QA por 30 dias (migration 086, /admin/testadores, aviso "Modo teste") | No ar (`fc58f45`, `58c779b`, push 09/10) |
| Mais Vendidos | Pedidos pagos ou entregues (30 dias), sem loja de teste; menos de 4 produtos → cliques e "Mais procurados" | No ar (`bced6b7`, push 09/10) |
| "preço Clube" para membro logado | "◆ assoc" vira "◆ preço Clube" nos cards; mensagens da carteirinha renovada e ativada | No ar (`8983402`, push 09/10) |
| Vitrine e convênios só em PDF | Vitrine com uma loja só mostra os produtos dela; "Meus convênios" só com o botão do PDF; migration 087 (Drogaria Sindical); `ParceiroDetalhe.jsx` apagada; planos sem selos sobrepostos e sem números sem prova | No ar (`01faaba`, `c761868`, `1a459fb`, `0454399`, push 09/10 11:07; migration 087 às 11:08) |
| Admin seguro | Registro de quem fez (migration 088), proteção entre admins, bloqueio até trocar a senha provisória; tela de contabilidades não mexe mais em conta admin | No ar (`39811ca`, `80cec31`, `51fa87f`, push 09/10 13:55; migration 088 às 13:55) |
| Sobras do convênio e promessas | Favoritos do banco, Memória com símbolos, sem "Benefício associado", "IUB MAIS+" em tudo, e-mails "preço Clube no IUB MAIS+"; "Comece grátis", sem push e Instagram nos planos, Pioneiro "20 vagas", Roleta sem "milhares" | No ar (`0afeaa9`, `0ca390f`, push 09/10 13:55) |

### Commits locais esperando aprovação (09/10, terceira rodada)

| O que é |
|---|
| Ajustes de tela: "Aprovada por Fulano" em duas linhas e tabela de Comissões cabendo em 1366 px (data embaixo do protocolo); cadeado no lugar de "só o dono troca a senha"; número do coração conta só o que aparece em Favoritos; topo do /vender sem "Grátis" |
| Perfil financeiro (migration 089) |

A conta ADMIN-002 do Edmar é criada no perfil financeiro só depois do push do perfil.

## O que falta em cada parte

| Parte | O que falta | Esforço |
|---|---|---|
| a3. Política e termos | Política de Privacidade e termos com o Clube, a razão social e "nome fantasia: Grupo Movv" (junto com a parte 10 do pedido pelo site) | 1h + revisão do Junior |
| b1–b5. Loja do Clube | Benefício da loja (percentual, mínimo por tipo, produtos excluídos ou escolhidos), tela no painel, função `clubeAtivo`, termo de adesão com aceite registrado, preço Clube no pedido e no site, entrega grátis, selo "Clube X%", vitrine "Lojas do Clube", alerta de preço para o admin, contador de economia | Cerca de 3 dias e meio |
| c. Preço dos planos | Trocar "CNPJ em dia na Base SECI" por "Loja do Clube ativa", reconferir em cada renovação, aviso antes de perder o preço, ligar `PRECO_LOJA_CLUBE_ATIVO` | 1 dia |
| d2. Assinatura de R$ 9,90 | Cobrança mensal (Mercado Pago), cartão do Clube, cancelamento, aviso de vencimento | 2 dias |
| e. Convênios | Trocar o PDF pelo admin sem deploy (hoje o arquivo está no código, em `backend/uploads/beneficios/catalogo-beneficios-seci.pdf`). Anotado no TODO.md | Meio dia |
| Admin | Tabela de Parceiros não cabe em 1366 px (Saldo, Status e Ações pedem rolagem para o lado) | A decidir |

## Lojas (09/10/2026)

- **Única loja pública:** 14 Imaginari Personalizados (Master de cortesia).
- **Pausadas:** 1 a 9 (contas automáticas dos convênios do SECI: Drogaria Sindical, Academia Atlética, Diroma Fiori, Óticas Diniz, Ezequiel Reis, Plenitude, Nesplora, Laura Clemente, Studio Vip), 15 Azul Empréstimo (Premium de cortesia) e 16 Gêmeos Moda Masculina. Não apagar.
- **De teste** (`empresa_teste`, só em modo QA): 18 Burguer Teste (ativa), 47 Adega Teste, 49 Pet Teste, 50 Serviço Teste e 51 Mercado Teste (pausadas). Limpeza: `node scripts/lojas_teste_limpar.js`.
- **Aguardando plano:** 48 (vendedor pessoa física de teste do Junior).

## Onde está no código

- Regra de quem tem o benefício: `backend/src/services/beneficioAssociado.js`.
- Preço que a pessoa paga: `backend/src/services/pedidoLoja.js` e `frontend/src/pages/public/Marketplace/precoPessoa.js` (mesma regra).
- Página do Clube: `frontend/src/pages/public/Marketplace/Clube.jsx` (`/clube`) e `backend/src/routes/clubePublico.js` (interessados). Cartão do Clube: `backend/src/routes/clubeCartao.js` (`api.iubmais.com.br/clube/:hash`).
- Convênios: `backend/src/routes/publicPainel.js` (`/convenios`, `/convenios/pdf`), `frontend/src/pages/public/Cadastro/MeusConvenios.jsx`.
- Planos: `backend/src/config/planos.js` (fonte única) e `PRECO_LOJA_CLUBE_ATIVO`.
- Pedido pelo site e lojas de teste: `docs/pedidos-site.md`.

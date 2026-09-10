// TODO: notificação push diária "🎁 Seu presente do dia chegou!" (task 7
// do spec da Roleta da Sorte) — NÃO IMPLEMENTADO.
//
// Motivo: este projeto não tem nenhuma infraestrutura de cron nem de
// envio de push (sem node-cron, sem web-push, sem backend/src/jobs até
// este arquivo, sem `Serviço de Notificação` nenhum — conferido no
// código antes de escrever isso, ver planos.js onde push_notification é
// só uma promessa de plano, "trabalho manual", não dispara nada sozinho).
// Implementar isso de verdade exige decidir DUAS coisas de infra que não
// são só desta feature:
//   1. Onde roda o scheduler (node-cron dentro do próprio processo do
//      Render? Um Render Cron Job separado batendo num endpoint interno?)
//   2. Como mandar push de verdade pro navegador/PWA do associado (Web
//      Push API + VAPID keys + salvar subscription por associado em
//      alguma tabela nova) — hoje não existe glue nenhum disso.
//
// Quando isso for priorizado, o pseudocódigo seria:
//
//   async function notificarRoletaDiaria() {
//     const associados = await buscarAssociadosComSessaoAtiva(); // definir o que é "ativa"
//     for (const associado of associados) {
//       await enviarPush(associado, {
//         titulo: '🎁 Seu presente do dia chegou!',
//         corpo: 'Gire a roleta e ganhe um cupom!',
//         url: '/jogar/roleta',
//       });
//     }
//   }
//   // node-cron: cron.schedule('0 10 * * *', notificarRoletaDiaria, { timezone: 'America/Sao_Paulo' });
//
// Até lá, a Roleta funciona 100% sem isso — associado descobre o jogo
// pelo slide no carrossel da home (SlideRoleta.jsx) ou pelo link "🎁 Meus
// Cupons" no Meu Painel, não depende de notificação nenhuma.

module.exports = {};

const { sendWhatsAppMessage } = require('./zapApiService');
const { SERVICOS_PET, PERIODOS_PET } = require('../config/pet');

// Avisos de WhatsApp do pedido de horário (Pet parte 3), pela mesma Z-API
// das mensagens de conta/carteirinha. Nunca travam nem derrubam o pedido:
// o registro no banco é a fonte da verdade e o painel mostra tudo; se o
// WhatsApp falhar (instância desconectada, número errado), a tela oferece o
// link wa.me manual. Devolve true/false pra tela saber qual caso foi.

const FRONT = (process.env.FRONTEND_URL || 'https://iubmais.com.br').replace(/\/$/, '');
const URL_PAINEL_PETSHOP = `${FRONT}/parceiro/painel/agendamentos`;
const URL_MEUS_PETS = `${FRONT}/meu/pets`;

const nomeServico = c => SERVICOS_PET.find(s => s.codigo === c)?.nome || c;
const nomePeriodo = c => PERIODOS_PET.find(p => p.codigo === c)?.nome.toLowerCase() || c;
function dataBR(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  const dia = new Date(`${a}-${m}-${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${dia} ${d}/${m}`;
}
const quando = (data, periodo) => `${dataBR(data)}, ${nomePeriodo(periodo)}`;

// Espera no máximo 6s (a Z-API tem timeout de 20s): passou disso, a tela
// responde "não deu pra avisar" e mostra o link manual — a mensagem ainda
// pode chegar depois, o que é inofensivo.
async function enviar(numero, texto) {
  if (!numero) return false;
  try {
    const r = await Promise.race([
      sendWhatsAppMessage(numero, texto),
      new Promise(resolve => setTimeout(() => resolve({ success: false }), 6000)),
    ]);
    return Boolean(r?.success);
  } catch (err) {
    console.error('[petAvisos]', err.message);
    return false;
  }
}

// Cliente pediu → pet shop
function avisarNovoPedido({ parceiroWhatsapp, ag, clienteNome }) {
  return enviar(parceiroWhatsapp,
    `🐾 *Novo pedido de horário — IUB MAIS+*\n\n` +
    `${clienteNome} quer *${nomeServico(ag.servico)}* pro *${ag.pet_nome}*${ag.pet_resumo ? ` (${ag.pet_resumo})` : ''}.\n` +
    `📅 ${quando(ag.data, ag.periodo)}` +
    (ag.observacao ? `\n📝 "${ag.observacao}"` : '') +
    `\n\nConfirme ou proponha outro horário no painel:\n${URL_PAINEL_PETSHOP}`);
}

// Pet shop respondeu → cliente
function avisarResposta({ clienteWhatsapp, ag, parceiroNome }) {
  const cab = `🐾 *${parceiroNome}* respondeu seu pedido de *${nomeServico(ag.servico)}* pro *${ag.pet_nome}*:`;
  const recado = ag.resposta ? `\n📝 "${ag.resposta}"` : '';
  let corpo;
  if (ag.status === 'confirmado') corpo = `\n\n✅ *Confirmado:* ${quando(ag.data, ag.periodo)}.${recado}`;
  else if (ag.status === 'proposta') corpo = `\n\n🔄 Não dá no dia pedido. *Proposta:* ${quando(ag.proposta_data, ag.proposta_periodo)}.${recado}\n\nAceite ou cancele em:\n${URL_MEUS_PETS}`;
  else corpo = `\n\n❌ Não vai dar pra atender desta vez.${recado}\n\nVocê pode pedir outro dia em:\n${URL_MEUS_PETS}`;
  return enviar(clienteWhatsapp, cab + corpo);
}

// Cliente aceitou a proposta ou cancelou → pet shop
function avisarClienteMudou({ parceiroWhatsapp, ag, clienteNome }) {
  const txt = ag.status === 'confirmado'
    ? `✅ ${clienteNome} *aceitou* o horário proposto pro *${ag.pet_nome}* (${nomeServico(ag.servico)}): ${quando(ag.data, ag.periodo)}.`
    : `❌ ${clienteNome} *cancelou* o pedido de ${nomeServico(ag.servico)} pro *${ag.pet_nome}* (${quando(ag.data, ag.periodo)}).`;
  return enviar(parceiroWhatsapp, `🐾 *IUB MAIS+*\n\n${txt}\n\n${URL_PAINEL_PETSHOP}`);
}

// Parte 4: pet shop mandou a 1ª foto do atendimento → dono (veja e avalie)
function avisarFotosProntas({ clienteWhatsapp, ag, parceiroNome }) {
  return enviar(clienteWhatsapp,
    `📸 *${parceiroNome}* mandou as fotos do *${ag.pet_nome}* (${nomeServico(ag.servico)}).\n\n` +
    `Veja o antes e depois e conte como foi — sua avaliação ajuda outros tutores:\n${URL_MEUS_PETS}`);
}

// Parte 4: cliente avaliou → pet shop
function avaliarEstrelas(n) { return '⭐'.repeat(n); }
function avisarNovaAvaliacao({ parceiroWhatsapp, ag, nota, comentario }) {
  return enviar(parceiroWhatsapp,
    `🐾 *Nova avaliação — IUB MAIS+*\n\n${avaliarEstrelas(nota)} pro atendimento do *${ag.pet_nome}* (${nomeServico(ag.servico)})` +
    (comentario ? `\n📝 "${comentario}"` : '') +
    `\n\nResponda pelo painel (a resposta fica pública):\n${URL_PAINEL_PETSHOP}`);
}

// Parte 5: pet shop registrou o atendimento (leu o QR do pet ou marcou
// como realizado) → dono, com o cartão e o link pra contestar
function avisarAtendimentoRegistrado({ clienteWhatsapp, petNome, parceiroNome, fidelidade }) {
  let cartao = '';
  if (fidelidade?.premio) {
    const ate = new Date(fidelidade.premio.expira_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    cartao = `\n\n🎁 *Cartão completo!* Prêmio liberado: *${fidelidade.premio.premio_texto}* (vale até ${ate}).`;
  } else if (fidelidade) {
    cartao = `\n\n🎟️ Cartão fidelidade: *${fidelidade.carimbos}/${fidelidade.meta}* — faltam ${fidelidade.meta - fidelidade.carimbos} pra ganhar *${fidelidade.cartao.premio}*.`;
  }
  return enviar(clienteWhatsapp,
    `🐾 *${parceiroNome}* registrou o atendimento do *${petNome}* hoje ✅${cartao}\n\nNão foi você? Avise em:\n${URL_MEUS_PETS}`);
}

// Parte 5: cliente leu o QR do balcão → pet shop confirma
function avisarClienteRegistrou({ parceiroWhatsapp, clienteNome, petNome, servico }) {
  return enviar(parceiroWhatsapp,
    `🐾 *IUB MAIS+*\n\n${clienteNome} registrou pelo QR do balcão o atendimento de *${nomeServico(servico)}* do *${petNome}*.\n\nConfirme pra contar no cartão fidelidade:\n${FRONT}/parceiro/painel/fidelidade`);
}

// Parte 5: dono contestou ("não fui eu") → pet shop
function avisarContestado({ parceiroWhatsapp, clienteNome, petNome, dia }) {
  return enviar(parceiroWhatsapp,
    `⚠️ *IUB MAIS+*\n\n${clienteNome} disse que o atendimento do *${petNome}* registrado em ${dataBR(dia)} não foi dele. O carimbo foi retirado.\n\n${FRONT}/parceiro/painel/fidelidade`);
}

module.exports = {
  avisarNovoPedido, avisarResposta, avisarClienteMudou, avisarFotosProntas, avisarNovaAvaliacao,
  avisarAtendimentoRegistrado, avisarClienteRegistrou, avisarContestado, dataBR,
};

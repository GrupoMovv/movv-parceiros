// Canal de atendimento do PRÓPRIO IUB MAIS+ (não do SECI). Fica aqui, e não
// dentro de uma tela, porque mais de uma página promete atendimento — painel
// do parceiro (Planos.jsx) e a pública /vender (Vender.jsx). Um lugar só pra
// ligar o canal evita que uma delas continue prometendo WhatsApp depois.
//
// Enquanto `whatsapp` for null, NENHUMA tela mostra botão/link de contato:
// cada uma cai num texto neutro. Pra ligar, preencha o número aqui — com ou
// sem o DDI 55, `linkWhatsapp` normaliza.
export const CONTATO_IUBMAIS = {
  whatsapp: null, // ex.: '5564999999999' ou '64999999999'
  site: null,     // ex.: 'https://iubmais.com.br'
};

export const MSG_WHATSAPP_PADRAO = 'Olá! Quero saber mais sobre os planos do IUB MAIS+';

// Texto usado quando ainda não existe canal, pra todas as telas falarem igual.
export const SEM_CANAL_AINDA = 'Em breve teremos canal dedicado pra tirar dúvidas.';

export function linkWhatsapp(numero, mensagem = MSG_WHATSAPP_PADRAO) {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (!digitos) return null;
  const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}

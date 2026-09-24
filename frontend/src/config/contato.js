// Canal de atendimento do PRÓPRIO IUB MAIS+ como empresa/plataforma (não do
// SECI, não dos parceiros). Única fonte do número institucional: rodapé,
// 404, painel do parceiro, /vender, /entregadores leem daqui.
//
// NÃO usar pra pedido/contato de parceiro (Food, Disk Bebidas, vitrine):
// esses vão pro WhatsApp do PRÓPRIO parceiro, que tem o chip dele.
//
// Links em api.whatsapp.com (não wa.me): o redirecionamento do wa.me
// corrompe emoji no texto pré-preenchido.
export const CONTATO_IUB = {
  whatsapp: '5564992359408',
  whatsappExibicao: '(64) 99235-9408',
  whatsappLink: 'https://api.whatsapp.com/send?phone=5564992359408',
  // Escondido de propósito até o domínio iubmais.com.br estar no ar — melhor
  // sem e-mail do que e-mail que volta. Pra mostrar, é só ligar a flag.
  email: 'contato@iubmais.com.br',
  emailAtivo: false,
  cidade: 'Itumbiara/GO',
  razaoSocial: 'Grupo Movv - IUB MAIS+',
};

// Mensagens padrão: contato geral (rodapé, páginas) e suporte (Fale Conosco).
export const MSG_WHATSAPP_SITE = 'Olá! Vim pelo site IUB MAIS+.';
export const MSG_WHATSAPP_SUPORTE = 'Olá! Preciso de suporte no IUB MAIS+.';

export function linkWhatsapp(numero, mensagem = MSG_WHATSAPP_SITE) {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (!digitos) return null;
  const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://api.whatsapp.com/send?phone=${comDdi}&text=${encodeURIComponent(mensagem)}`;
}

// Atalho pro WhatsApp do IUB MAIS+ com a mensagem que o contexto pedir.
export function linkWhatsappIub(mensagem = MSG_WHATSAPP_SITE) {
  return linkWhatsapp(CONTATO_IUB.whatsapp, mensagem);
}

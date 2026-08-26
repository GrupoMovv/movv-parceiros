// wa.me faz um redirect server-side pra api.whatsapp.com que corrompe emojis
// (qualquer caractere fora do ASCII básico vira U+FFFD) mesmo com encodeURIComponent
// correto. Apontar direto pra api.whatsapp.com evita esse redirect e preserva os emojis.
function montarLinkWhatsapp(telefone, mensagem) {
  const digits = String(telefone || '').replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=55${digits}&text=${encodeURIComponent(mensagem)}`;
}

module.exports = { montarLinkWhatsapp };

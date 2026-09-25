// IP de verdade de quem fez a requisição.
//
// Antes cada lugar pegava o PRIMEIRO item do X-Forwarded-For — que é
// justamente o que o próprio visitante pode escrever no header (basta mandar
// "X-Forwarded-For: 1.2.3.4"). Com isso qualquer limite "por IP" (login,
// cadastro, código de senha) era burlado trocando o header a cada tentativa.
//
// Agora vale req.ip do Express com `trust proxy` = número de proxies na
// frente do app (app.js, env TRUST_PROXY_HOPS, padrão 1 = balanceador do
// Render). O Express lê o X-Forwarded-For DA DIREITA pra esquerda e para no
// IP que o nosso proxy viu — o que o visitante escreve à esquerda é ignorado.
// Se aparecer IP de proxy no lugar do visitante, conferir em
// GET /api/sindicato/base-seci/diagnostico-ip e ajustar TRUST_PROXY_HOPS.
function ipCliente(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '') || null;
}

module.exports = { ipCliente };

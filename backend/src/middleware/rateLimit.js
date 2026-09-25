const { ipCliente } = require('../utils/ipCliente');
// Rate limit básico em memória (sem dependência nova) pra rotas públicas
// sensíveis a spam. Não é distribuído entre instâncias — aceitável aqui,
// é só uma barreira contra abuso trivial, não proteção contra ataque sério.
function simpleRateLimit({ windowMs, max }) {
  const hits = new Map();

  return (req, res, next) => {
    const ip = ipCliente(req) || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
}

module.exports = { simpleRateLimit };

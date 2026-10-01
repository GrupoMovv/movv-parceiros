const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { ipCliente } = require('../utils/ipCliente');

// Registros de acesso exigidos pelo Marco Civil (art. 15): data, hora e IP
// de uso da plataforma, por 6 meses (migration 078). Nunca atrasa nem
// derruba a requisição: grava em segundo plano e só loga se falhar.
//
// Volume: toda escrita (POST/PUT/PATCH/DELETE — inclui login e cadastro) é
// gravada. Leitura (GET) grava no máximo 1x a cada JANELA_LEITURA_MS por
// pessoa+IP — o polling do PIX (a cada 3s) e a navegação viram uma linha a
// cada 10 min, o suficiente pra provar "usou a partir deste IP nesta hora".

const JANELA_LEITURA_MS = 10 * 60 * 1000;
const GUARDA_MESES = 6;
const LIMPEZA_A_CADA_MS = 24 * 3600 * 1000;
// Rotas que não são acesso de pessoa: webhook do Mercado Pago, cron, health.
const IGNORAR = /^\/api\/(health|webhook\/|interno\/)/;

const ultimaLeitura = new Map();
let ultimaLimpeza = 0;

// Quem é, pelo token (os 3 sistemas de login assinam com o mesmo
// JWT_SECRET). Token inválido/expirado = anônimo — quem barra é o auth da rota.
function identificar(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return { tipo: 'anonimo' };
  let d;
  try {
    d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
  } catch {
    return { tipo: 'anonimo' };
  }
  if (d.type === 'parceiro') return { tipo: 'parceiro', usuarioId: d.usuario_id, parceiroId: d.parceiro_id };
  if (d.type === 'painel_publico') return { tipo: 'painel_publico', usuarioId: d.associado_id };
  if (d.userType === 'internal' || d.userType === 'indicator') return { tipo: d.userType, usuarioId: d.id };
  if (d.id) return { tipo: 'partner', usuarioId: d.id };
  return { tipo: 'anonimo' };
}

function inteiro(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 2147483648 ? n : null;
}

function limparAntigos() {
  ultimaLimpeza = Date.now();
  db.query(`DELETE FROM registros_acesso WHERE criado_em < NOW() - INTERVAL '${GUARDA_MESES} months'`)
    .then(r => { if (r.rowCount) console.log(`[registro-acesso] ${r.rowCount} registros com mais de ${GUARDA_MESES} meses apagados`); })
    .catch(err => console.error('[registro-acesso] limpeza falhou:', err.message));
  // O Map de leituras só serve pra janela atual — esvazia o que já passou.
  const corte = Date.now() - JANELA_LEITURA_MS;
  for (const [k, t] of ultimaLeitura) if (t < corte) ultimaLeitura.delete(k);
}

function registrarAcesso(req, res, next) {
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api/') || IGNORAR.test(req.path)) return next();
  try {
    const ip = ipCliente(req);
    if (ip) {
      const quem = identificar(req);
      const agora = Date.now();
      const chave = `${quem.tipo}:${quem.usuarioId || ''}:${ip}`;
      const leitura = req.method === 'GET' || req.method === 'HEAD';
      if (!leitura || agora - (ultimaLeitura.get(chave) || 0) >= JANELA_LEITURA_MS) {
        if (leitura) ultimaLeitura.set(chave, agora);
        db.query(
          `INSERT INTO registros_acesso (ip, metodo, rota, tipo_usuario, usuario_id, parceiro_id, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ip.slice(0, 45), req.method.slice(0, 8), req.path.slice(0, 200), quem.tipo,
            inteiro(quem.usuarioId), inteiro(quem.parceiroId), String(req.headers['user-agent'] || '').slice(0, 300) || null]
        ).catch(err => console.error('[registro-acesso] não gravou:', err.message));
      }
      if (agora - ultimaLimpeza >= LIMPEZA_A_CADA_MS) limparAntigos();
    }
  } catch (err) {
    console.error('[registro-acesso] erro:', err.message);
  }
  return next();
}

module.exports = { registrarAcesso, identificar };

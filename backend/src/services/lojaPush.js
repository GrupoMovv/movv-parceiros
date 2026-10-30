const webpush = require('web-push');
const db = require('../config/database');

// Notificação do navegador para a loja (A5): pedido novo chega no celular
// mesmo com o site minimizado. Chaves VAPID só pelo ambiente (Render):
// VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY. Sem as chaves, nada é enviado e o
// painel não oferece o botão. O WhatsApp continua sendo o aviso principal:
// isto é um reforço e nunca trava o pedido.
const CONTATO = 'mailto:contato@iubmais.com.br';

function chavePublica() {
  return (process.env.VAPID_PUBLIC_KEY || '').trim() || null;
}

let configurado = null;
function configurar() {
  const pub = chavePublica();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv) return false;
  const chave = `${pub}:${priv}`;
  if (configurado !== chave) {
    webpush.setVapidDetails(CONTATO, pub, priv);
    configurado = chave;
  }
  return true;
}

async function inscrever(parceiroId, usuarioId, inscricao, navegador) {
  const endpoint = String(inscricao?.endpoint || '');
  const { p256dh, auth } = inscricao?.keys || {};
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return false;
  await db.query(
    `INSERT INTO loja_push_aparelhos (parceiro_id, usuario_id, endpoint, p256dh, auth, navegador)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET parceiro_id = $1, usuario_id = $2, p256dh = $4, auth = $5, navegador = $6`,
    [parceiroId, usuarioId || null, endpoint, p256dh, auth, String(navegador || '').slice(0, 200) || null]
  );
  return true;
}

async function cancelar(parceiroId, endpoint) {
  await db.query('DELETE FROM loja_push_aparelhos WHERE parceiro_id = $1 AND endpoint = $2', [parceiroId, String(endpoint || '')]);
}

async function quantosAparelhos(parceiroId) {
  return (await db.query('SELECT COUNT(*)::int AS n FROM loja_push_aparelhos WHERE parceiro_id = $1', [parceiroId])).rows[0].n;
}

// Manda para todos os aparelhos da loja. Devolve quantos receberam.
// { title, body, url, tag }: o formato que o src/sw.js do site mostra.
async function enviarParaLoja(parceiroId, notificacao) {
  if (!configurar()) return 0;
  const aparelhos = (await db.query('SELECT * FROM loja_push_aparelhos WHERE parceiro_id = $1', [parceiroId])).rows;
  let enviados = 0;
  for (const a of aparelhos) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(notificacao),
        { TTL: 10 * 60, urgency: 'high', timeout: 6000 }
      );
      enviados++;
      await db.query('UPDATE loja_push_aparelhos SET ultimo_envio_em = NOW() WHERE id = $1', [a.id]);
    } catch (err) {
      // 404/410: o navegador desfez a inscrição (desinstalou, limpou dados)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.query('DELETE FROM loja_push_aparelhos WHERE id = $1', [a.id]);
      } else {
        console.error('[lojaPush]', a.id, err.statusCode || '', err.message);
      }
    }
  }
  return enviados;
}

module.exports = { chavePublica, inscrever, cancelar, quantosAparelhos, enviarParaLoja };

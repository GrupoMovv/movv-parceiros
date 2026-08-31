// Rota "canônica" da carteirinha, pensada pra ser a URL compartilhada/QR
// (não a URL do frontend direto): SPAs não têm HTML pronto no primeiro
// request, então crawlers de preview (WhatsApp, Facebook, etc.) — que NÃO
// executam JavaScript — nunca veem as meta tags que a página React seta via
// useEffect. Aqui a gente detecta esses bots pelo User-Agent e devolve HTML
// já pronto com og:title/og:image/og:description; pra qualquer humano, só
// redireciona (302) pra experiência completa no frontend.
const router = require('express').Router();
const db = require('../config/database');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://portal.grupomovv.com.br';
const BACKEND_URL = process.env.BACKEND_URL || 'https://movv-backend.onrender.com';

const BOT_UA_REGEX = /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|vkshare|w3c_validator|applebot|embedly|quora link preview|outbrain|nuzzel|ia_archiver/i;

function isBot(userAgent) {
  return BOT_UA_REGEX.test(userAgent || '');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function buscarResumoPublico(hash) {
  const associado = await db.query(
    'SELECT nome_completo, foto_url FROM sindicato_associados WHERE carteirinha_hash = $1',
    [hash]
  );
  if (associado.rows[0]) return associado.rows[0];

  const dependente = await db.query(
    `SELECT d.nome AS nome_completo
     FROM sindicato_associados_dependentes d
     JOIN sindicato_associados a ON a.id = d.associado_id
     WHERE d.carteirinha_hash = $1`,
    [hash]
  );
  // dependente não tem foto própria ainda — nunca usar a do titular aqui
  // (paginaMeta já cai no fallback do logo quando foto_url é undefined)
  return dependente.rows[0] || null;
}

// `canonicalUrl` vai em og:url (é a URL "compartilhável", a do backend —
// mesma que o bot buscou). `redirectUrl` é só pro meta-refresh, e aponta
// direto pro frontend: se algum humano cair nessa página por engano (bot
// mal-detectado), o refresh não deve voltar pra essa mesma rota — voltaria
// a cair no isBot() de novo em vez de ir de vez pra experiência completa.
function paginaMeta({ title, description, image, canonicalUrl, redirectUrl }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const i = escapeHtml(image);
  const cu = escapeHtml(canonicalUrl);
  const ru = escapeHtml(redirectUrl);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta property="og:type" content="profile">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:url" content="${cu}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${ru}">
</head>
<body>
<p>Redirecionando... <a href="${ru}">clique aqui</a> se não for automático.</p>
</body>
</html>`;
}

router.get('/carteirinha/:hash', async (req, res) => {
  const { hash } = req.params;
  const destino = `${FRONTEND_URL}/carteirinha/${hash}`;
  const canonicalUrl = `${BACKEND_URL}/carteirinha/${hash}`;

  if (!isBot(req.headers['user-agent'])) {
    return res.redirect(302, destino);
  }

  try {
    const dados = await buscarResumoPublico(hash);
    if (!dados) {
      return res.status(404).send(paginaMeta({
        title: 'Carteirinha não encontrada — SECI',
        description: 'Este link de carteirinha não é válido.',
        image: `${FRONTEND_URL}/logo-header.png`,
        canonicalUrl, redirectUrl: destino,
      }));
    }

    const image = dados.foto_url ? `${BACKEND_URL}${dados.foto_url}` : `${FRONTEND_URL}/logo-header.png`;

    return res.send(paginaMeta({
      title: `${dados.nome_completo} - Carteirinha SECI`,
      description: 'SECI - Sindicato dos Empregados no Comércio de Itumbiara/GO',
      image,
      canonicalUrl, redirectUrl: destino,
    }));
  } catch (err) {
    console.error(err);
    return res.redirect(302, destino);
  }
});

module.exports = router;

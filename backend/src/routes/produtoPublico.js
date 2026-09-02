// Mesma logica de carteirinhaPublica.js: bots de preview (WhatsApp, Facebook
// etc.) nao executam JS, entao nunca veem as meta tags que a pagina React
// seta via useEffect. Aqui a gente detecta o bot pelo User-Agent e devolve
// HTML pronto com og:title/og:image/og:description (+ JSON-LD Product);
// humano de verdade so recebe um 302 pra experiencia completa no frontend.
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

router.get('/produto/:id', async (req, res) => {
  const { id } = req.params;
  const destino = `${FRONTEND_URL}/marketplace/produto/${id}`;
  const canonicalUrl = `${BACKEND_URL}/produto/${id}`;

  if (!isBot(req.headers['user-agent'])) {
    return res.redirect(302, destino);
  }

  try {
    const result = await db.query(
      `SELECT pr.nome, pr.descricao, pr.preco, pr.fotos, pa.nome AS parceiro_nome
       FROM sindicato_parceiro_produtos pr
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       WHERE pr.id = $1 AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'`,
      [id]
    );
    const produto = result.rows[0];

    if (!produto) {
      const t = escapeHtml('Produto não encontrado — IUB MAIS');
      return res.status(404).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${t}</title>
<meta property="og:title" content="${t}"><meta http-equiv="refresh" content="0; url=${destino}"></head>
<body><a href="${destino}">Clique aqui</a></body></html>`);
    }

    const precoFmt = parseFloat(produto.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const image = produto.fotos?.[0]?.url ? `${BACKEND_URL}${produto.fotos[0].url}` : `${FRONTEND_URL}/iub-logo-og.png`;
    const t = escapeHtml(`${produto.nome} — ${produto.parceiro_nome} | IUB MAIS`);
    const d = escapeHtml(`${precoFmt} — ${(produto.descricao || '').slice(0, 150)}`);
    const i = escapeHtml(image);
    const cu = escapeHtml(canonicalUrl);
    const ru = escapeHtml(destino);

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: produto.nome,
      description: produto.descricao,
      image: [image],
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: produto.preco,
        availability: 'https://schema.org/InStock',
        url: canonicalUrl,
      },
    });

    return res.send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta property="og:type" content="product">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:url" content="${cu}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${ru}">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<p>Redirecionando... <a href="${ru}">clique aqui</a> se não for automático.</p>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    return res.redirect(302, destino);
  }
});

module.exports = router;

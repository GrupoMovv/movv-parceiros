// Cartão do Clube MAIS+ — o link que o cliente manda para a loja (mensagens
// de WhatsApp de produto, promoção e "Minha lista") e, depois, o QR do
// balcão. Mostra SÓ nome, se o Clube está ativo e até quando. Nunca mostra
// por qual porta a pessoa entrou (sindicato ou assinatura), empresa, número
// ou SECI — filiação sindical é dado sensível (decisão do Junior, 07/10).
// Página completa (HTML pronto, sem redirecionar): quem abre é a loja.
const router = require('express').Router();
const db = require('../config/database');
const { SITUACAO_SQL, JOIN_EMPRESA_SQL } = require('../services/beneficioAssociado');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://iubmais.com.br').replace(/\/$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'https://api.iubmais.com.br').replace(/\/$/, '');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = d => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function pagina({ titulo, nome, ativo, validade, hash }) {
  const cor = ativo ? '#15803D' : '#B45309';
  const fundo = ativo ? '#DCFCE7' : '#FEF3C7';
  const status = ativo ? '✅ Membro ativo' : '⚠️ Clube não está ativo';
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="Cartão do Clube MAIS+ — preço Clube nas lojas do IUB MAIS+.">
<meta property="og:image" content="${FRONTEND_URL}/iub-logo-og.png">
<meta property="og:url" content="${BACKEND_URL}/clube/${esc(hash)}">
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F3FF;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1E1B4B;padding:16px}
  .cartao{width:100%;max-width:360px;background:linear-gradient(135deg,#4C1D95,#7C3AED);color:#fff;border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(76,29,149,.3)}
  .marca{font-weight:900;font-size:22px;letter-spacing:.5px}.sub{opacity:.8;font-size:13px;margin-top:2px}
  .nome{font-size:20px;font-weight:800;margin-top:28px;word-break:break-word}
  .status{display:inline-block;margin-top:14px;background:${fundo};color:${cor};font-weight:800;font-size:14px;border-radius:999px;padding:6px 12px}
  .validade{margin-top:10px;font-size:14px;opacity:.9}
  .rodape{margin-top:22px;font-size:12px;opacity:.75}
  a{color:#fff}
</style></head>
<body><div class="cartao">
  <div class="marca">💎 Clube MAIS+</div><div class="sub">IUB MAIS+ · Itumbiara</div>
  ${nome ? `<div class="nome">${esc(nome)}</div>` : ''}
  <div class="status">${status}</div>
  ${validade ? `<div class="validade">${ativo ? 'Válido até' : 'Venceu em'} ${esc(validade)}</div>` : ''}
  <div class="rodape">Loja do Clube: aplique o preço Clube para este membro. <a href="${FRONTEND_URL}/marketplace">iubmais.com.br</a></div>
</div></body></html>`;
}

router.get('/clube/:hash', async (req, res) => {
  const hash = String(req.params.hash || '').slice(0, 100);
  try {
    const r = await db.query(
      `SELECT a.nome_completo, a.legado, a.carteirinha_valida_ate, ${SITUACAO_SQL} AS situacao
       FROM sindicato_associados a ${JOIN_EMPRESA_SQL}
       WHERE a.carteirinha_hash = $1`,
      [hash]
    );
    const p = r.rows[0];
    res.set('Cache-Control', 'no-store');
    if (!p) {
      return res.status(404).send(pagina({ titulo: 'Cartão do Clube MAIS+ não encontrado', nome: null, ativo: false, validade: null, hash }));
    }
    const ativo = p.situacao === 'ativo';
    const validade = !p.legado && p.carteirinha_valida_ate ? dataBR(p.carteirinha_valida_ate) : null;
    return res.send(pagina({ titulo: `${p.nome_completo} — Cartão do Clube MAIS+`, nome: p.nome_completo, ativo, validade, hash }));
  } catch (err) {
    console.error('[cartão do Clube]', err.message);
    return res.status(500).send('Não foi possível abrir o cartão agora.');
  }
});

module.exports = router;

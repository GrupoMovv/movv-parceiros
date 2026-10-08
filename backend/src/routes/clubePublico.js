const router = require('express').Router();
const db = require('../config/database');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { onlyDigits } = require('../utils/validators');
const { ipCliente } = require('../utils/ipCliente');

// /api/public/clube — Clube MAIS+.
// POST /interessados { nome, whatsapp, autorizou_contato, origem }
// "Quero ser avisado" da assinatura de R$ 9,90 (lista de interessados, parte
// d1). Um registro por WhatsApp: pedir de novo só atualiza nome/autorização.
router.post('/interessados', simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 10 }), lerPainelPublicoOpcional, async (req, res) => {
  try {
    const b = req.body || {};
    const nome = String(b.nome || '').replace(/<[^>]*>/g, '').trim().slice(0, 120);
    let whatsapp = onlyDigits(b.whatsapp).replace(/^55(?=\d{10,11}$)/, '');
    if (nome.length < 2) return res.status(400).json({ error: 'Diga o seu nome.', campo: 'nome' });
    if (whatsapp.length < 10 || whatsapp.length > 11) return res.status(400).json({ error: 'WhatsApp inválido. Use o DDD + número.', campo: 'whatsapp' });
    if (b.autorizou_contato !== true) return res.status(400).json({ error: 'Marque a autorização para avisarmos você.', campo: 'autorizou_contato' });
    const origem = ['pagina_clube', 'produto', 'promocao'].includes(b.origem) ? b.origem : 'pagina_clube';
    await db.query(
      `INSERT INTO clube_interessados (nome, whatsapp, autorizou_contato, associado_id, origem, ip)
       VALUES ($1, $2, true, $3, $4, $5)
       ON CONFLICT (whatsapp) DO UPDATE SET nome = EXCLUDED.nome, autorizou_contato = true,
         associado_id = COALESCE(EXCLUDED.associado_id, clube_interessados.associado_id), atualizado_em = NOW()`,
      [nome, whatsapp, req.painelAssociado?.id || null, origem, ipCliente(req)]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[clube interessados]', err.message);
    return res.status(500).json({ error: 'Não deu para salvar agora. Tente de novo.' });
  }
});

module.exports = router;

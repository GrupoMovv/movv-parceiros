const crypto = require('crypto');
const router = require('express').Router();
const assinaturaService = require('../services/assinaturaService');
const carteirinhaAvisos = require('../services/carteirinhaAvisosService');

// Rotinas internas disparadas por agendador externo (Render Cron Job) —
// o projeto não roda cron dentro do processo (o serviço web pode dormir no
// plano Free/Starter). Protegido por CRON_SECRET no header x-cron-secret.
//
// Render -> New -> Cron Job, schedule "0 9 * * *" (UTC = 6h em Itumbiara), comando:
//   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://<backend>/api/interno/assinaturas/rotina

const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

function exigirSegredo(req, res, next) {
  if (!CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET não configurado' });
  const recebido = Buffer.from(String(req.headers['x-cron-secret'] || ''));
  const esperado = Buffer.from(CRON_SECRET);
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  return next();
}

// POST /api/interno/assinaturas/rotina — encerra planos vencidos, lembra
// renovação de PIX e limpa cobranças abandonadas. Idempotente.
router.post('/assinaturas/rotina', exigirSegredo, async (req, res) => {
  const inicio = Date.now();
  try {
    const r = await assinaturaService.rotinaDiaria();
    console.log('[rotina assinaturas]', JSON.stringify(r), `${Date.now() - inicio}ms`);
    return res.json({ ok: true, ...r, duracao_ms: Date.now() - inicio });
  } catch (err) {
    console.error('[rotina assinaturas] falhou:', err);
    return res.status(500).json({ error: 'rotina falhou', detalhe: err.message });
  }
});

// POST /api/interno/carteirinhas/rotina — avisos de WhatsApp da carteirinha
// de 6 meses (vence em 30 dias / venceu). Idempotente: aviso já enviado
// nunca repete (tabela carteirinha_avisos). Mesmo Cron Job, segundo curl:
//   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://<backend>/api/interno/carteirinhas/rotina
router.post('/carteirinhas/rotina', exigirSegredo, async (req, res) => {
  const inicio = Date.now();
  try {
    const r = await carteirinhaAvisos.rotinaDiaria();
    console.log('[rotina carteirinhas]', JSON.stringify(r), `${Date.now() - inicio}ms`);
    return res.json({ ok: true, ...r, duracao_ms: Date.now() - inicio });
  } catch (err) {
    console.error('[rotina carteirinhas] falhou:', err);
    return res.status(500).json({ error: 'rotina falhou', detalhe: err.message });
  }
});

module.exports = router;

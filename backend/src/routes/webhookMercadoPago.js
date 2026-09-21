const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/webhookMercadoPagoController');

// Público (quem chama é o Mercado Pago) — a proteção é a assinatura HMAC
// validada no controller. Rate limit alto: só barra abuso grosseiro, sem
// arriscar derrubar rajada legítima de notificações do MP.
router.post('/', simpleRateLimit({ windowMs: 60 * 1000, max: 300 }), ctrl.receber);

module.exports = router;

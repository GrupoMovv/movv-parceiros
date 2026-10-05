const router = require('express').Router();
const ctrl = require('../controllers/pedidoLinkLojaController');
const { simpleRateLimit } = require('../middleware/rateLimit');

// Link do pedido pra LOJA, sem login (/api/public/pedido-loja/:token).
router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 60 }));
router.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex'); next(); });

router.get('/:token', ctrl.ver);
router.post('/:token/:acao', ctrl.agir);

module.exports = router;

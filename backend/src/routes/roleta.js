const router = require('express').Router();
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/roletaController');

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 80 }));
router.use(authenticatePainelPublico);

router.get('/status', ctrl.getStatus);
router.post('/girar', ctrl.girar);
router.get('/meus-cupons', ctrl.getMeusCupons);
router.post('/cupons/:id/usar', ctrl.marcarComoUsado);

module.exports = router;

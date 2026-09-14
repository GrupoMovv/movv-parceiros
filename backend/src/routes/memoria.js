const router = require('express').Router();
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/memoriaController');

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 80 }));
router.use(authenticatePainelPublico);

router.post('/partida',     ctrl.registrarPartida);
router.get('/meu-recorde',  ctrl.getMeuRecorde);
router.get('/ranking',      ctrl.getRanking);

module.exports = router;

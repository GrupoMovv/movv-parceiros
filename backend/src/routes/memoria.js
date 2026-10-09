const router = require('express').Router();
const { authenticatePainelPublico, lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/memoriaController');

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 80 }));

// Visitante (sem login) joga todos os níveis e VÊ o ranking; salvar
// partida/recorde (e entrar no ranking) continua só com conta.
router.get('/niveis',       lerPainelPublicoOpcional, ctrl.getMeusNiveis);
router.get('/ranking',      lerPainelPublicoOpcional, ctrl.getRanking);
router.get('/lojas',        ctrl.getLojas);
router.post('/partida',     authenticatePainelPublico, ctrl.registrarPartida);
router.get('/meu-recorde',  authenticatePainelPublico, ctrl.getMeuRecorde);

module.exports = router;

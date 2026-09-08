const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroFechaMesController');

router.use(authenticateParceiro);
router.get('/proximo', ctrl.getProximo);
router.get('/meus', ctrl.getMeus);
router.post('/participar', ctrl.participar);
router.get('/historico', ctrl.getHistorico);

module.exports = router;

const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroInteressadosController');

router.use(authenticateParceiro);

router.get('/',  ctrl.listarMeuInteresse);
router.post('/', ctrl.marcarInteresse);

module.exports = router;

const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroJogosController');

router.use(authenticateParceiro);
router.get('/', ctrl.getConfig);
router.put('/', ctrl.salvarConfig);

module.exports = router;

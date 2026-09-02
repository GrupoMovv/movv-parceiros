const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroDashboardController');

router.use(authenticateParceiro);
router.get('/stats', ctrl.stats);

module.exports = router;

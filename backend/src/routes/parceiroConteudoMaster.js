const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroConteudoMasterController');

router.use(authenticateParceiro);
router.get('/materiais', ctrl.listarMateriais);
router.get('/lives', ctrl.listarLives);

module.exports = router;

const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/lojaClubeController');

// Loja do Clube MAIS+ — aba "Clube MAIS+" do painel (/api/parceiro/clube).
router.use(authenticateParceiro);
router.get('/', ctrl.ver);
router.put('/', ctrl.salvar);      // entrar ou mudar o benefício (com o aceite do termo)
router.post('/sair', ctrl.sair);

module.exports = router;

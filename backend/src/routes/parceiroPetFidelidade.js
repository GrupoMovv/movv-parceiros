const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPetFidelidadeController');

// Pet parte 5 — cartão fidelidade, QR e atendimentos realizados (pet shop).
router.use(authenticateParceiro);

router.get('/',                                   ctrl.painel);
router.put('/cartoes',                            ctrl.salvarCartoes);
router.get('/qr/:token',                          ctrl.lerQrPet);
router.post('/atendimentos',                      ctrl.registrar);
router.post('/atendimentos/:id/:acao(confirmar|recusar)', ctrl.decidir);
router.post('/premios/:id/resgatar',              ctrl.resgatar);

module.exports = router;

const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/lojaVendedoresController');

// Equipe de vendas da loja — aba "Equipe de vendas" do painel (/api/parceiro/equipe).
router.use(authenticateParceiro);
router.get('/', ctrl.ver);
router.post('/', ctrl.criar);
router.put('/:id(\\d+)', ctrl.editar);
router.post('/:id(\\d+)/desativar', ctrl.desativar);
router.post('/:id(\\d+)/ativar', ctrl.ativar);
router.post('/:id(\\d+)/novo-codigo', ctrl.novoCodigo);

module.exports = router;

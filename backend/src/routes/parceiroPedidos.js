const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPedidosController');

// Pedido pelo site — painel da loja (/api/parceiro/pedidos).
router.use(authenticateParceiro);

router.get('/config', ctrl.getConfig);
router.put('/config', ctrl.salvarConfig);
router.patch('/config/pausa', ctrl.pausar);

module.exports = router;

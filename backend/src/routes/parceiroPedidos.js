const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPedidosController');

// Pedido pelo site — painel da loja (/api/parceiro/pedidos).
router.use(authenticateParceiro);

router.get('/config', ctrl.getConfig);
router.put('/config', ctrl.salvarConfig);
router.patch('/config/pausa', ctrl.pausar);
router.patch('/config/whatsapp-extra', ctrl.salvarWhatsappExtra);
router.post('/config/teste', ctrl.enviarTeste);

// Aviso no celular (A5)
router.get('/push', ctrl.pushSituacao);
router.post('/push/inscrever', ctrl.pushInscrever);
router.post('/push/cancelar', ctrl.pushCancelar);
router.post('/push/teste', ctrl.pushTeste);

// Aba Pedidos (parte 7)
router.get('/', ctrl.listarPedidos);
router.get('/contagem', ctrl.contagemPedidos);
router.get('/:id(\\d+)', ctrl.verPedido);
router.post('/:id(\\d+)/complemento/:acao', ctrl.agirComplemento);
router.post('/:id(\\d+)/:acao', ctrl.agirPedido);

module.exports = router;

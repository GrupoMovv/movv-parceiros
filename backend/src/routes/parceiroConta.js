const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroContaController');

// Montado em /api/parceiro (ver app.js) — os dois primeiros caminhos são
// os pedidos como top-level (/api/parceiro/dados-conta, /notificacoes);
// o resto fica agrupado em /conta/* por não ter um caminho pedido explícito.
router.use(authenticateParceiro);

router.put('/dados-conta',  ctrl.atualizarDadosConta);
router.put('/notificacoes', ctrl.atualizarNotificacoes);

router.get('/conta',                    ctrl.obterConta);
router.post('/conta/pausar',            ctrl.pausarConta);
router.post('/conta/reativar',          ctrl.reativarConta);
router.post('/conta/solicitar-exclusao', ctrl.solicitarExclusao);

module.exports = router;

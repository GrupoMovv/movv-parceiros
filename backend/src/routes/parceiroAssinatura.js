const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/parceiroAssinaturaController');

// Leitura (inclui o polling do QR a cada 3s = 20/min) e criação de
// cobrança com limites separados — gerar PIX em loop é o que precisa
// barrar, consultar status não.
const limiteLeitura = simpleRateLimit({ windowMs: 60 * 1000, max: 90 });
const limiteCobranca = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 15 });

router.use(authenticateParceiro);

router.get('/opcoes',                 limiteLeitura, ctrl.opcoes);
router.get('/minha',                  limiteLeitura, ctrl.minha);
router.get('/pagamentos/:id/status',  limiteLeitura, ctrl.statusPagamento);
router.post('/criar-pix',             limiteCobranca, ctrl.criarPix);
router.post('/pix/renovar',           limiteCobranca, ctrl.renovarPix);
router.post('/criar-cartao-recorrente', limiteCobranca, ctrl.criarCartaoRecorrente);
router.post('/cancelar',              limiteCobranca, ctrl.cancelar);

module.exports = router;

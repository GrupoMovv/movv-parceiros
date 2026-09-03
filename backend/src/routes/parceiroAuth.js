const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroAuthController');
const contaCtrl = require('../controllers/parceiroContaController');

router.post('/login', simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), ctrl.login);
router.post('/esqueci-senha', simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), ctrl.esqueciSenha);
router.post('/redefinir-senha', ctrl.redefinirSenha);
router.post('/logout', ctrl.logout);
router.get('/me', authenticateParceiro, ctrl.me);
// limite por IP aqui é só uma segunda camada — a defesa principal é o
// contador por conta dentro de alterarSenha (ver parceiroContaController).
router.put('/senha', authenticateParceiro, simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), contaCtrl.alterarSenha);

module.exports = router;

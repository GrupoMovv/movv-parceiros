const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroAuthController');

router.post('/login', simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), ctrl.login);
router.post('/esqueci-senha', simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), ctrl.esqueciSenha);
router.post('/redefinir-senha', ctrl.redefinirSenha);
router.post('/logout', ctrl.logout);
router.get('/me', authenticateParceiro, ctrl.me);

module.exports = router;

const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/contaController');

// Conta do IUB MAIS+ (/entrar). Limite por IP além do bloqueio por conta
// (senha errada 5x = 15 min; data de nascimento errada 3x = 30 min).
const limite = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

router.post('/login',           limite, ctrl.login);
router.post('/primeiro-acesso', limite, ctrl.primeiroAcesso);
router.post('/criar',           limite, ctrl.criar);
router.post('/esqueci-senha',   limite, ctrl.esqueciSenha);
router.post('/redefinir-senha', limite, ctrl.redefinirSenha);

module.exports = router;

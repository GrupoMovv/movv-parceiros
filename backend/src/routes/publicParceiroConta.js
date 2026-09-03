const router = require('express').Router();
const ctrl = require('../controllers/parceiroContaController');

// Clicados a partir de link de e-mail, sem sessão — mesmo padrão do
// esqueci-senha/redefinir-senha do parceiro.
router.post('/confirmar-email',    ctrl.confirmarEmailPendente);
router.post('/confirmar-exclusao', ctrl.confirmarExclusao);

module.exports = router;

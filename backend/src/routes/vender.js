const router = require('express').Router();
const ctrl = require('../controllers/parceiroSolicitacaoController');

router.post('/verificar-cnpj', ctrl.verificarCnpj);
router.post('/solicitacao',    ctrl.criarSolicitacao);

module.exports = router;

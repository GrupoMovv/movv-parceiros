const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/entregadoresController');

// Pré-cadastro público do IUB+ ENTREGADORES (/entregadores).
router.post('/pre-cadastro', simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), ctrl.criarPreCadastro);

module.exports = router;

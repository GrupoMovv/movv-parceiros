const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/baseSeciController');

// Barreira contra varredura de CPF/CNPJ em sequência a partir do mesmo IP.
router.get('/', simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 30 }), ctrl.verificarPublico);

module.exports = router;

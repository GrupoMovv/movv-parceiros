const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/entregadoresController');

// Lista de espera do IUB+ ENTREGADORES — só admin (tem WhatsApp de gente
// que ainda nem é parceira).
router.use(authenticate, requireAdmin);
router.get('/pre-cadastros', ctrl.listarPreCadastros);
router.patch('/:id/status', ctrl.atualizarStatus);

module.exports = router;

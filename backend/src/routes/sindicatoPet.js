const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoPetController');

// Moderação das avaliações de pet shop — só admin (mesmo critério do Disk Bebidas).
router.use(authenticate, requireAdmin);
router.get('/avaliacoes', ctrl.listar);
router.post('/avaliacoes/:id/ocultar', ctrl.ocultar);

module.exports = router;

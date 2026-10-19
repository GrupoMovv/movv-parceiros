const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/lojaClubeController');

// Clube MAIS+ no admin: Lojas do Clube, interessados na assinatura e termo.
// Só admin (a lista de interessados tem nome e WhatsApp).
router.use(authenticate, requireAdmin);
router.get('/', ctrl.resumo);
router.post('/termos', ctrl.publicarTermo);

module.exports = router;

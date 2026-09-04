const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const ctrl = require('../controllers/carrinhoController');

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 120 }));

// Visitante sem sessão (localStorage) — não exige login.
router.post('/detalhar', ctrl.detalhar);

// Associado logado (carrinho persistido no banco).
router.get('/',                authenticatePainelPublico, ctrl.listar);
router.post('/adicionar',      authenticatePainelPublico, ctrl.adicionar);
router.delete('/remover/:produto_id', authenticatePainelPublico, ctrl.remover);
router.post('/limpar',         authenticatePainelPublico, ctrl.limpar);
router.post('/migrar',         authenticatePainelPublico, ctrl.migrar);

module.exports = router;

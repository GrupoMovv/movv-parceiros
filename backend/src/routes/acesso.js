const router = require('express').Router();
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/acessoController');

// Primeiro acesso público (/acesso). Limite por IP além do bloqueio por CPF
// (data de nascimento) que já existe no controller.
const limite = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 15 });

router.post('/seci',     limite, ctrl.cadastroSeci);
router.post('/comercio', limite, ctrl.cadastroComercio);
router.post('/basico',   limite, ctrl.cadastroBasico);
// Lista única de segmentos (o front não repete a lista — valida contra esta).
router.get('/segmentos', (req, res) => res.json(ctrl.SEGMENTOS));

module.exports = router;

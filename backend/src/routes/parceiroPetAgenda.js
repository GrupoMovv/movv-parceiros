const router = require('express').Router();
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPetAgendaController');

// Pet parte 3 — pedidos de horário recebidos pelo pet shop.
router.use(authenticateParceiro);

router.get('/',               ctrl.listar);
router.post('/:id/responder', ctrl.responder);

module.exports = router;

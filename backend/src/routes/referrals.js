const router = require('express').Router();
const { authenticate, requireEquipe } = require('../middleware/auth');
const { listReferrals, createReferral, confirmSale, expireOldReferrals, ultimaExpiracao, atualizarDados } = require('../controllers/referralController');

router.get('/', authenticate, listReferrals);
router.post('/', authenticate, createReferral);
router.put('/:id/confirm', authenticate, requireEquipe, confirmSale);
// CPF e contrato da indicação (equipe: os dois; dono: só o CPF, se vazio)
router.patch('/:id/dados', authenticate, atualizarDados);
router.post('/expire', authenticate, requireEquipe, expireOldReferrals);
router.get('/expire/ultimo', authenticate, requireEquipe, ultimaExpiracao);

module.exports = router;

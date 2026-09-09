const router = require('express').Router();
const ctrl = require('../controllers/publicPlanosController');

router.get('/precos', ctrl.precos);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/petController');

// Catálogo do segmento Pet (serviços, portes, raças) e a busca do
// /marketplace/pet — públicos.
router.get('/catalogo',  ctrl.catalogo);
router.get('/parceiros', ctrl.listarPublico);

module.exports = router;

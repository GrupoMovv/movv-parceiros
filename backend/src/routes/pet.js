const router = require('express').Router();
const ctrl = require('../controllers/petController');
const { lerAdminOpcional } = require('../middleware/auth');

// Admin logado no mesmo navegador = modo QA (vê as empresas de teste)
router.use(lerAdminOpcional);

// Catálogo do segmento Pet (serviços, portes, raças) e a busca do
// /marketplace/pet — públicos.
router.get('/catalogo',  ctrl.catalogo);
router.get('/parceiros', ctrl.listarPublico);
router.get('/parceiros/:slug/avaliacoes', ctrl.avaliacoesPublicas);

module.exports = router;

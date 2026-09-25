const router = require('express').Router();
const { SERVICOS_PET, PORTES_PET, CATEGORIA_PET } = require('../config/pet');

// Catálogo do segmento Pet — o front (cadastro, painel, marketplace) não
// repete a lista, lê daqui.
router.get('/catalogo', (req, res) => res.json({ categoria: CATEGORIA_PET, servicos: SERVICOS_PET, portes: PORTES_PET }));

module.exports = router;

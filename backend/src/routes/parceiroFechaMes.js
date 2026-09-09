const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroFechaMesController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Envie um arquivo JPG, PNG ou WEBP'));
    }
    cb(null, true);
  },
});

router.use(authenticateParceiro);
router.get('/proximo', ctrl.getProximo);
router.get('/meus', ctrl.getMeus);
router.post('/participar', ctrl.participar);
router.post('/produto-bonus', upload.single('foto'), ctrl.criarProdutoBonus);
router.put('/produtos/:id', ctrl.editarProduto);
router.delete('/produtos/:id', ctrl.removerProduto);
router.get('/historico', ctrl.getHistorico);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

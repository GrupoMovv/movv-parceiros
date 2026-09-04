const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/cadastrarAssociadoController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Foto deve ser JPG ou PNG'));
    }
    cb(null, true);
  },
});

router.use(simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));

router.post('/verificar', ctrl.verificarElegibilidade);
router.post('/completar', upload.single('foto'), ctrl.completarCadastro);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio' });
  }
  next();
});

module.exports = router;

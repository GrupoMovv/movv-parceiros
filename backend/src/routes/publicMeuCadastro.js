const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/publicMeuCadastroController');

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

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 60 }));

router.get('/:edit_token',                        ctrl.getMeuCadastro);
router.put('/:edit_token',                         ctrl.updateMeuCadastro);
router.put('/:edit_token/foto', upload.single('foto'), ctrl.updateFotoTitular);
router.put('/:edit_token/dependente/:dependente_id/foto', upload.single('foto'), ctrl.updateFotoDependente);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio' });
  }
  next();
});

module.exports = router;

const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const ctrl = require('../controllers/publicPainelController');

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

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 80 }));
router.use(authenticatePainelPublico);

router.get('/me',    ctrl.getMe);
router.put('/me',    ctrl.updateMe);
router.post('/reenviar-carteirinha', ctrl.reenviarCarteirinha);
router.post('/foto', upload.single('foto'), ctrl.uploadFoto);
router.post('/dependentes',              ctrl.updateDependentes);
router.post('/dependentes/:dependente_id/foto', upload.single('foto'), ctrl.uploadFotoDependente);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio' });
  }
  next();
});

module.exports = router;

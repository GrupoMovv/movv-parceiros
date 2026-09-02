const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPerfilController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Envie um arquivo JPG, PNG ou WEBP'));
    }
    cb(null, true);
  },
});

router.use(authenticateParceiro);

router.get('/',            ctrl.getPerfil);
router.put('/',             ctrl.updatePerfil);
router.post('/logo',        upload.single('logo'), ctrl.uploadLogo);
router.post('/fotos',       upload.array('fotos', 5), ctrl.uploadFotos);
router.delete('/fotos/:index', ctrl.deleteFoto);
router.put('/fotos/ordem',  ctrl.reordenarFotos);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

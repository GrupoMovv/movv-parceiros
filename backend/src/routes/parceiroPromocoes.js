const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPromocoesController');

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

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',    ctrl.create);
router.put('/:id',  ctrl.update);
router.delete('/:id', ctrl.remover);
router.post('/:id/toggle',   ctrl.toggleStatus);
router.post('/:id/duplicar', ctrl.duplicar);
router.post('/:id/foto', upload.single('foto'), ctrl.uploadFoto);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoContribuintesController');

// Só admin/Junior vê essa base — é o gate do autocadastro público, mais
// sensível que a listagem de associados (que Renan também administra).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(file.mimetype)
      || /\.xlsx?$/i.test(file.originalname || '');
    if (!ok) return cb(new Error('Envie um arquivo .xlsx ou .xls'));
    cb(null, true);
  },
});

router.use(authenticate, requireAdmin);

router.get('/stats',          ctrl.stats);
router.get('/importacoes',    ctrl.listImportacoes);
router.get('/',               ctrl.listContribuintes);
router.post('/upload/preview',   upload.single('arquivo'), ctrl.uploadPreview);
router.post('/upload/confirmar', ctrl.confirmarImportacao);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

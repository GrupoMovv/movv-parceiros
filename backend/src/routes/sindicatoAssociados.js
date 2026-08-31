const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoAssociadosController');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/dependentes');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `dependente_${req.params.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Envie um arquivo JPG ou PNG'));
    }
    cb(null, true);
  },
});

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/stats',        ctrl.stats);
router.get('/',              ctrl.listAssociados);
router.get('/:id',           ctrl.getAssociado);
router.post('/',             ctrl.createAssociado);
router.put('/:id',           ctrl.updateAssociado);
router.put('/:id/status',    ctrl.updateStatus);
router.put('/dependente/:id/foto', upload.single('foto'), ctrl.uploadFotoDependente);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

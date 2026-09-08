const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoPlanosController');

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso
// completo — mesmo padrão de sindicatoSolicitacoes.js/parceiroSolicitacoes.js.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

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

router.use(authenticate, requireSindicatoAccess);

router.get('/config', ctrl.config);

router.get('/parceiros', ctrl.listarParceiros);
router.patch('/parceiros/:id/plano', ctrl.alterarPlano);
router.patch('/parceiros/:id/status', ctrl.alterarStatusPlano);
router.patch('/parceiros/:id/perfil-plano', ctrl.atualizarPerfilPlano);
router.post('/parceiros/:id/banner', upload.single('banner'), ctrl.uploadBanner);
router.delete('/parceiros/:id/banner', ctrl.removerBanner);

router.get('/historico', ctrl.historico);

router.get('/lives', ctrl.listarLivesAdmin);
router.post('/lives', ctrl.criarLive);
router.put('/lives/:id', ctrl.atualizarLive);
router.delete('/lives/:id', ctrl.removerLive);

router.get('/materiais', ctrl.listarMateriaisAdmin);
router.post('/materiais', ctrl.criarMaterial);
router.put('/materiais/:id', ctrl.atualizarMaterial);
router.delete('/materiais/:id', ctrl.removerMaterial);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

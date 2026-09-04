const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoListaAprovadaController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/empresas',            ctrl.listEmpresas);
router.get('/empresas/:nome',      ctrl.getEmpresa);
router.put('/:id/cancelar',        ctrl.cancelarAcesso);
router.put('/:id/reativar',        ctrl.reativarAcesso);
router.post('/importar/preview',   upload.single('arquivo'), ctrl.importarPreview);
router.post('/importar/commit',    ctrl.importarCommit);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio do arquivo' });
  }
  next();
});

module.exports = router;

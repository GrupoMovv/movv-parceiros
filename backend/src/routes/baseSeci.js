const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/baseSeciController');
const { statusInstancia } = require('../services/zapApiService');

// Leitura: admin e Renan (colaborador interno, role sindicato_aprendiz).
// Importar/exportar/sempre ativa: só admin — a base tem CPF de filiado
// pessoa física e o arquivo inteiro sair daqui é tratamento de dado (LGPD).
const podeLer = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.originalname || '')) return cb(new Error('Envie um arquivo .xlsx, .xls ou .csv'));
    cb(null, true);
  },
});

router.use(authenticate);

router.get('/',                   podeLer,      ctrl.listar);
router.get('/historico',          podeLer,      ctrl.historico);
router.get('/exportar',           requireAdmin, ctrl.exportar);
router.post('/importar/preview',  requireAdmin, upload.single('arquivo'), ctrl.previewImportacao);
router.post('/importar',          requireAdmin, upload.single('arquivo'), ctrl.importar);
router.patch('/:id/sempre-ativa', requireAdmin, ctrl.setSempreAtiva);

// Chip do WhatsApp (Z-API) conectado? Só consulta, não envia nada.
router.get('/whatsapp-status', requireAdmin, async (req, res) => res.json(await statusInstancia()));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  return res.status(400).json({ error: err.message || 'Erro no upload' });
});

module.exports = router;

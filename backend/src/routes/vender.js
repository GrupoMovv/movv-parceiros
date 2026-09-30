const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/parceiroSolicitacaoController');
const pfCtrl = require('../controllers/vendedorPfController');

router.post('/verificar-cnpj', ctrl.verificarCnpj);
router.post('/solicitacao',    ctrl.criarSolicitacao);

// Vendedor Pessoa Física (CPF): documento + selfie vão pro Cloudinary como
// arquivos PRIVADOS (nunca link público) — ver vendedorPfController.
const uploadDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new Error('Envie as fotos em JPG, PNG ou WEBP'));
    cb(null, true);
  },
}).fields([{ name: 'documento', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]);

router.get('/pessoa-fisica/config', pfCtrl.config);
router.post('/pessoa-fisica', (req, res, next) => uploadDocs(req, res, err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Foto muito grande (máximo 8 MB)' : (err.message || 'Erro no envio das fotos') });
  return next();
}), pfCtrl.cadastrar);

module.exports = router;

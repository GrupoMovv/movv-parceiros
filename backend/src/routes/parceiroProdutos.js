const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroProdutosController');
const iaCtrl = require('../controllers/parceiroIaController');
const { MIMETYPES_AUDIO, mimetypeBase } = require('../services/openaiService');

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

// Áudio do cadastro por voz — o front limita a gravação a 60s (webm/opus
// dá ~0,5 MB), 10 MB é folga pra Safari/mp4, bem abaixo dos 25 MB do Whisper.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIMETYPES_AUDIO.includes(mimetypeBase(file.mimetype))) {
      return cb(new Error('Formato de áudio não suportado'));
    }
    cb(null, true);
  },
});

router.use(authenticateParceiro);

router.get('/',     ctrl.list);
// Precisa vir antes de "/:id" -- senão o Express casa "ia-status" como
// valor de :id e cai no handler errado.
router.get('/ia-status',         iaCtrl.getStatus);
router.post('/analisar-imagem',  upload.single('imagem'), iaCtrl.analisarImagem);
router.post('/cadastrar-por-voz', uploadAudio.single('audio'), iaCtrl.cadastrarPorVoz);
router.post('/cadastrar-por-voz-guiada', uploadAudio.single('audio'), iaCtrl.cadastrarPorVozGuiada);
router.get('/:id',  ctrl.getOne);
router.post('/',    ctrl.create);
router.put('/:id',  ctrl.update);
router.delete('/:id', ctrl.remover);
router.put('/:id/toggle-status', ctrl.toggleStatus);
router.post('/:id/fotos', upload.array('fotos', 3), ctrl.uploadFotos);
router.delete('/:id/fotos/:index', ctrl.deleteFoto);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

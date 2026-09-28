const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroPetAgendaController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new Error('Foto deve ser JPG, PNG ou WEBP'));
    cb(null, true);
  },
});

// Pet partes 3-4 — pedidos de horário, fotos antes/depois e avaliações do pet shop.
router.use(authenticateParceiro);

router.get('/',               ctrl.listar);
router.post('/:id/responder', ctrl.responder);
router.post('/:id/fotos',     upload.array('fotos', 3), ctrl.enviarFotos);
router.delete('/:id/fotos/:fotoId', ctrl.removerFoto);
router.post('/:id/avaliacao/resposta', ctrl.responderAvaliacao);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) return res.status(400).json({ error: err.message || 'Erro no envio' });
  next();
});

module.exports = router;

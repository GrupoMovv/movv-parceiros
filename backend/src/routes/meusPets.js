const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const ctrl = require('../controllers/meusPetsController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new Error('Foto deve ser JPG, PNG ou WEBP'));
    cb(null, true);
  },
});

// Pet parte 3 — ficha do pet e pedidos de horário do CLIENTE (conta do /meu).
router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 120 }));
router.use(authenticatePainelPublico);

// "/agendamentos" antes de "/:id" (senão casa como id)
router.get('/agendamentos',                 ctrl.meusPedidos);
router.post('/agendamentos',                ctrl.pedirHorario);
router.post('/agendamentos/:id/aceitar',    ctrl.aceitarProposta);
router.post('/agendamentos/:id/cancelar',   ctrl.cancelarPedido);

router.get('/',        ctrl.listar);
router.post('/',       ctrl.criar);
router.put('/:id',     ctrl.atualizar);
router.delete('/:id',  ctrl.remover);
router.post('/:id/foto', upload.single('foto'), ctrl.enviarFoto);
router.delete('/:id/autorizacoes/:parceiroId', ctrl.revogar);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) return res.status(400).json({ error: err.message || 'Erro no envio' });
  next();
});

module.exports = router;

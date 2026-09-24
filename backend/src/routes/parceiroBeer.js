const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroBeerController');

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

// Aba "Meu IUB Beer" (IUB Disk Bebidas) do painel do parceiro.
router.use(authenticateParceiro);
router.get('/meu', ctrl.getMeu);
router.put('/meu', ctrl.salvarMeu);
router.post('/meu/desativar', ctrl.desativar);

// Daqui pra baixo só com a extensão ativa.
router.post('/meu/status', ctrl.exigirExtensaoAtiva, ctrl.atualizarStatus);
router.get('/produtos', ctrl.exigirExtensaoAtiva, ctrl.listarProdutos);
router.post('/produtos', ctrl.exigirExtensaoAtiva, upload.single('foto'), ctrl.criarProduto);
router.put('/produtos/:id', ctrl.exigirExtensaoAtiva, upload.single('foto'), ctrl.editarProduto);
router.delete('/produtos/:id', ctrl.exigirExtensaoAtiva, ctrl.excluirProduto);
router.post('/produtos/:id/disponibilidade', ctrl.exigirExtensaoAtiva, ctrl.atualizarDisponibilidade);
router.post('/produtos/:id/oferta', ctrl.exigirExtensaoAtiva, ctrl.salvarOferta);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

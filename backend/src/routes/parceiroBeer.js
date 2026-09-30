const router = require('express').Router();
const multer = require('multer');
const { authenticateParceiro } = require('../middleware/parceiroAuth');
const ctrl = require('../controllers/parceiroBeerController');
const iaCtrl = require('../controllers/parceiroIaController');

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
// "fotos" (várias, na ordem; a 1ª é a principal) e "foto" (1 — telas antigas em cache)
const fotosDoForm = upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'fotos', maxCount: 3 }]);
router.post('/produtos', ctrl.exigirExtensaoAtiva, fotosDoForm, ctrl.criarProduto);
// Cadastro por foto com IA (mesma cota da IA do formulário comum); só SUGERE
router.post('/produtos/analisar-imagem', ctrl.exigirExtensaoAtiva, upload.single('imagem'), iaCtrl.analisarImagemBeer);
router.put('/produtos/:id', ctrl.exigirExtensaoAtiva, fotosDoForm, ctrl.editarProduto);
// Fotos do produto — mesmo contrato do formulário comum (useGaleriaFotos)
router.post('/produtos/:id/fotos', ctrl.exigirExtensaoAtiva, fotosDoForm, ctrl.enviarFotos);
router.put('/produtos/:id/fotos/ordem', ctrl.exigirExtensaoAtiva, ctrl.reordenarFotos);
router.delete('/produtos/:id/fotos/:index', ctrl.exigirExtensaoAtiva, ctrl.removerFoto);
router.delete('/produtos/:id', ctrl.exigirExtensaoAtiva, ctrl.excluirProduto);
router.post('/produtos/:id/disponibilidade', ctrl.exigirExtensaoAtiva, ctrl.atualizarDisponibilidade);
router.post('/produtos/:id/oferta', ctrl.exigirExtensaoAtiva, ctrl.salvarOferta);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Máximo de 3 fotos por produto' });
  }
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Foto muito grande (máximo 5 MB)' });
  }
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

module.exports = router;

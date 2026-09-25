const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const ctrl = require('../controllers/publicPainelController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Foto deve ser JPG ou PNG'));
    }
    cb(null, true);
  },
});

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 80 }));
router.use(authenticatePainelPublico);

// Conta 'cliente' (outros segmentos) e 'pendente_seci' (empresa aguardando
// o Sindicato) usam o painel, mas não têm carteirinha nem dependentes.
const somenteAssociadoSeci = (req, res, next) => {
  if (req.painelAssociado.tipo_acesso === 'seci') return next();
  return res.status(403).json({ error: 'Disponível só para associados SECI.', code: 'SO_ASSOCIADO' });
};

router.get('/me',    ctrl.getMe);
router.put('/me',    ctrl.updateMe);
router.put('/perfil', ctrl.updateMe);
router.post('/reenviar-carteirinha', somenteAssociadoSeci, ctrl.reenviarCarteirinha);
router.post('/foto', upload.single('foto'), ctrl.uploadFoto);
router.post('/dependentes',              somenteAssociadoSeci, ctrl.updateDependentes);
router.post('/dependentes/adicionar',    somenteAssociadoSeci, ctrl.adicionarDependente);
router.put('/dependentes/:id',           somenteAssociadoSeci, ctrl.editarDependente);
router.delete('/dependentes/:id',        somenteAssociadoSeci, ctrl.removerDependente);
router.post('/dependentes/:dependente_id/foto', somenteAssociadoSeci, upload.single('foto'), ctrl.uploadFotoDependente);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio' });
  }
  next();
});

module.exports = router;

const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/publicCadastroController');

// Foto vem como Blob (canvas.toBlob) no multipart — guarda em memória e só
// grava em disco depois de criar o associado (precisa do id pro nome do arquivo).
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

router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 40 }));
// Camada extra de proteção por IP no "login" público — o bloqueio por CPF
// (3 tentativas/15min) já existe no controller, isso aqui é só contra
// alguém varrendo vários CPFs do mesmo IP.
const loginRateLimit = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 15 });

router.post('/validar-cnpj',         ctrl.validarCnpj);
router.post('/solicitar-empresa',    ctrl.solicitarEmpresa);
router.post('/verificar-cpf',        ctrl.verificarCpf);
router.post('/login',                loginRateLimit, ctrl.login);
router.post('/login-hash',           loginRateLimit, ctrl.loginPorHash);
router.post('/reenviar-carteirinha', ctrl.reenviarCarteirinha);
router.post('/finalizar', upload.single('foto'), ctrl.finalizarCadastro);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erro no envio' });
  }
  next();
});

module.exports = router;

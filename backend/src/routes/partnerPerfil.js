// "Meu perfil" do MOVV Partner: ver o próprio cadastro de pagamento e
// trocar a chave PIX (com a senha atual). Documento: só a equipe.
const router = require('express').Router();
const { authenticate, requireMovvPartner } = require('../middleware/auth');
const c = require('../controllers/partnerCadastroController');

router.use(authenticate, requireMovvPartner);
router.get('/', c.meuPerfil);
router.put('/pix', c.trocarMeuPix);

module.exports = router;

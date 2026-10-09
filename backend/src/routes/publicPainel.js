const router = require('express').Router();
const multer = require('multer');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { authenticatePainelPublico } = require('../middleware/painelPublicoAuth');
const ctrl = require('../controllers/publicPainelController');
const contaCtrl = require('../controllers/contaController');
const path = require('path');
const fs = require('fs');
const { situacaoDoAssociado } = require('../services/beneficioAssociado');

const CATALOGO_PDF_PATH = path.join(__dirname, '../../uploads/beneficios/catalogo-beneficios-seci.pdf');

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

// Conta 'cliente' (consumidor comum) usa o painel, mas não tem carteirinha
// nem dependentes.
const somenteAssociadoSeci = (req, res, next) => {
  if (req.painelAssociado.tipo_acesso === 'seci') return next();
  return res.status(403).json({ error: 'Disponível só para associados SECI.', code: 'SO_ASSOCIADO' });
};

router.get('/me',    ctrl.getMe);
router.put('/me',    ctrl.updateMe);
router.put('/perfil', ctrl.updateMe);
// Confirmar o WhatsApp por código (pedido pelo site). Limites de envio no serviço.
router.post('/whatsapp/enviar-codigo', ctrl.enviarCodigoWhatsapp);
router.post('/whatsapp/confirmar', ctrl.confirmarWhatsapp);
// Ativar desconto (cliente) / renovar carteirinha (associado) pelo CNPJ.
router.post('/empresa', contaCtrl.vincularEmpresa);
router.post('/reenviar-carteirinha', somenteAssociadoSeci, ctrl.reenviarCarteirinha);

// Convênios exclusivos do SECI (parte "e" do Clube, 08/10): só o associado
// logado vê — nada disso aparece no marketplace público. A fonte é o PDF
// (Junior, 09/10): a tabela seci_convenios fica no banco, mas não é exibida.
router.get('/convenios', somenteAssociadoSeci, async (req, res) => {
  try {
    const s = await situacaoDoAssociado(req.painelAssociado.id);
    return res.json({ situacao: s?.situacao || null, tem_pdf: fs.existsSync(CATALOGO_PDF_PATH) });
  } catch (err) {
    console.error('[convênios]', err.message);
    return res.status(500).json({ error: 'Não deu para carregar os convênios agora.' });
  }
});
// PDF de convênios, servido só com login de associado (antes: link público).
router.get('/convenios/pdf', somenteAssociadoSeci, (req, res) => {
  if (!fs.existsSync(CATALOGO_PDF_PATH)) return res.status(404).json({ error: 'Catálogo de convênios não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="convenios-seci.pdf"');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(CATALOGO_PDF_PATH);
});
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

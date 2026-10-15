// Livro de comissões do MOVV Partner (migration 093).
// Partner: só os próprios lançamentos (pela view) e a tabela do nível dele.
// Admin e financeiro (requireEquipe): lançamentos, aprovação, pagamento,
// estorno e avisos. Regras (percentuais): só admin completo.
// Lista de Partners: equipe e também o Fernando (comercial_full), que
// escolhe o "Partner responsável" na venda do Movv Certificado.
const router = require('express').Router();
const { authenticate, requireAdmin, requireEquipe, requireMovvPartner, requireAdminUniversidade } = require('../middleware/auth');
const { veTudo } = require('../config/perfilAdmin');
const multer = require('multer');
const c = require('../controllers/partnerComissoesController');
const i = require('../controllers/azulImportacaoController');
const cad = require('../controllers/partnerCadastroController');

const requireEquipeOuComercialFull = (req, res, next) => {
  if (veTudo(req.user) || (req.user?.type === 'internal' && req.user?.role === 'comercial_full')) return next();
  return res.status(403).json({ error: 'Acesso restrito' });
};

router.use(authenticate);

// Partner
router.get('/minhas', requireMovvPartner, c.minhas);
router.get('/tabela', requireMovvPartner, c.tabela);
router.get('/inicio', requireMovvPartner, c.inicio);
router.get('/vendas', requireMovvPartner, c.vendas);

// "Ver como Partner" (admin completo e comercial_full, como a Universidade)
router.get('/previa', requireAdminUniversidade, c.previa);

// Admin
router.get('/admin/partners',                    requireEquipeOuComercialFull, c.partners);
router.get('/admin/sugestao-certificado',        requireEquipeOuComercialFull, c.sugestaoCertificado);
// Cadastro para pagamento (migration 098): só admin e financeiro (o Fernando não)
router.get('/admin/cadastros',                   requireEquipe, cad.listar);
router.get('/admin/partners/:id/cadastro',       requireEquipe, cad.completo);
router.put('/admin/partners/:id/documento',      requireEquipe, cad.salvarDocumento);
router.get('/admin/lancamentos',                 requireEquipe, c.listar);
router.post('/admin/lancamentos',                requireEquipe, c.criarManual);
router.post('/admin/lancamentos/confirmar',      requireEquipe, c.confirmar);
router.post('/admin/lancamentos/aprovar',        requireEquipe, c.aprovar);
router.post('/admin/lancamentos/pagar',          requireEquipe, c.pagar);
router.post('/admin/lancamentos/:id/confirmar',  requireEquipe, c.confirmar);
router.post('/admin/lancamentos/:id/aprovar',    requireEquipe, c.aprovar);
router.post('/admin/lancamentos/:id/pagar',      requireEquipe, c.pagar);
router.post('/admin/lancamentos/:id/estornar',   requireEquipe, c.estornar);
router.get('/admin/regras',                      requireEquipe, c.listarRegras);
router.post('/admin/regras',                     requireAdmin,  c.salvarRegra);
router.put('/admin/regras/:id',                  requireAdmin,  c.salvarRegra);
router.get('/admin/avisos',                      requireEquipe, c.listarAvisos);
router.post('/admin/avisos/:id/tentar',          requireEquipe, c.tentarAviso);

// Importação mensal da Azul (Etapa 2). Arquivo só em memória, até 10 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.post('/admin/importacao/previa',          requireEquipe, upload.single('arquivo'), i.previa);
router.post('/admin/importacao/confirmar',       requireEquipe, upload.single('arquivo'), i.confirmar);
router.get('/admin/importacao/historico',        requireEquipe, i.historico);
router.get('/admin/importacao/pendencias',       requireEquipe, i.pendencias);
router.post('/admin/importacao/sugestoes/confirmar', requireEquipe, i.confirmarSugestoes);
router.post('/admin/importacao/linhas/:id/vincular',  requireEquipe, i.vincular);
router.post('/admin/importacao/linhas/:id/descartar', requireEquipe, i.descartar);
router.post('/admin/importacao/linhas/:id/tentar',    requireEquipe, i.tentar);
router.post('/admin/importacao/linhas/:id/estorno',   requireEquipe, i.decidirEstorno);
router.get('/admin/importacao/linhas',           requireEquipe, i.buscarLinhas);
router.get('/admin/importacao/indicacoes',       requireEquipe, i.buscarIndicacoes);

module.exports = router;

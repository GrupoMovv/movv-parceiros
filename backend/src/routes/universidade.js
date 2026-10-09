// Universidade MOVV Partner (migration 091). Partner: só os próprios dados.
// Administração: admin completo e comercial_full (Fernando); financeiro fora.
const router = require('express').Router();
const { authenticate, requireMovvPartner, requireAdminUniversidade } = require('../middleware/auth');
const c = require('../controllers/universidadeController');
const a = require('../controllers/universidadeAdminController');

router.use(authenticate);

// administração (antes das rotas do Partner)
router.get('/admin/progresso',                 requireAdminUniversidade, a.progresso);
router.get('/admin/conteudo',                  requireAdminUniversidade, a.conteudo);
router.post('/admin/partners',                 requireAdminUniversidade, a.criarPartner);
router.get('/admin/partners/:id',              requireAdminUniversidade, a.detalhePartner);
router.put('/admin/partners/:id',              requireAdminUniversidade, a.editarPartner);
router.post('/admin/partners/:id/redefinir-acesso', requireAdminUniversidade, a.redefinirAcesso);
router.patch('/admin/modulos/:id',             requireAdminUniversidade, a.editarModulo);
router.post('/admin/modulos/:id/mudanca-relevante', requireAdminUniversidade, a.mudancaRelevante);
router.post('/admin/modulos/:id/aulas',        requireAdminUniversidade, a.criarAula);
router.patch('/admin/aulas/:id',               requireAdminUniversidade, a.editarAula);
router.delete('/admin/aulas/:id',              requireAdminUniversidade, a.excluirAula);
router.post('/admin/aulas/:id/topicos',        requireAdminUniversidade, a.criarTopico);
router.patch('/admin/topicos/:id',             requireAdminUniversidade, a.editarTopico);
router.delete('/admin/topicos/:id',            requireAdminUniversidade, a.excluirTopico);
router.patch('/admin/perguntas/:id',           requireAdminUniversidade, a.editarPergunta);
router.put('/admin/termo',                     requireAdminUniversidade, a.salvarTermo);
router.patch('/admin/termo/:id/publicar',      requireAdminUniversidade, a.publicarTermo);
router.patch('/admin/config',                  requireAdminUniversidade, a.salvarConfig);

// Partner
router.get('/',                         requireMovvPartner, c.inicio);
router.get('/modulos/:numero',          requireMovvPartner, c.modulo);
router.post('/aulas/:id/lida',          requireMovvPartner, c.marcarLida);
router.get('/termo',                    requireMovvPartner, c.termo);
router.post('/aceite',                  requireMovvPartner, c.aceitar);
router.get('/modulos/:numero/quiz',     requireMovvPartner, c.quiz);
router.post('/modulos/:numero/quiz',    requireMovvPartner, c.responderQuiz);
router.get('/certificado',              requireMovvPartner, c.certificado);

module.exports = router;

// Livro de comissões do MOVV Partner (migration 093).
// Partner: só os próprios lançamentos (pela view) e a tabela do nível dele.
// Admin e financeiro (requireEquipe): lançamentos, aprovação, pagamento,
// estorno e avisos. Regras (percentuais): só admin completo.
// Lista de Partners: equipe e também o Fernando (comercial_full), que
// escolhe o "Partner responsável" na venda do Movv Certificado.
const router = require('express').Router();
const { authenticate, requireAdmin, requireEquipe, requireMovvPartner } = require('../middleware/auth');
const { veTudo } = require('../config/perfilAdmin');
const c = require('../controllers/partnerComissoesController');

const requireEquipeOuComercialFull = (req, res, next) => {
  if (veTudo(req.user) || (req.user?.type === 'internal' && req.user?.role === 'comercial_full')) return next();
  return res.status(403).json({ error: 'Acesso restrito' });
};

router.use(authenticate);

// Partner
router.get('/minhas', requireMovvPartner, c.minhas);
router.get('/tabela', requireMovvPartner, c.tabela);

// Admin
router.get('/admin/partners',                    requireEquipeOuComercialFull, c.partners);
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

module.exports = router;

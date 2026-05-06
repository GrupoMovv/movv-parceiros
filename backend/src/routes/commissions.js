const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listCommissions, getStatement, getSummaryByMonth, approveCommissions } = require('../controllers/commissionController');

router.get('/', authenticate, listCommissions);
router.get('/statement', authenticate, getStatement);
router.get('/summary', authenticate, getSummaryByMonth);
router.put('/approve', authenticate, requireAdmin, approveCommissions);

module.exports = router;

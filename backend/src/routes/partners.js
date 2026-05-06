const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  listPartners, getPartner, createPartner, updatePartner, resetPassword, getMyStats
} = require('../controllers/partnerController');

router.get('/stats', authenticate, getMyStats);
router.get('/', authenticate, requireAdmin, listPartners);
router.get('/:id', authenticate, requireAdmin, getPartner);
router.post('/', authenticate, requireAdmin, createPartner);
router.put('/:id', authenticate, requireAdmin, updatePartner);
router.put('/:id/reset-password', authenticate, requireAdmin, resetPassword);

module.exports = router;

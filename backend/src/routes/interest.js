const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { registerInterest, listInterest, updateInterest } = require('../controllers/interestController');

router.post('/', authenticate, registerInterest);
router.get('/admin', authenticate, requireAdmin, listInterest);
router.patch('/admin/:id', authenticate, requireAdmin, updateInterest);

module.exports = router;

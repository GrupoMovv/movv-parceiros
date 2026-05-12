const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getMonthlyStatement } = require('../controllers/reportController');

router.get('/monthly-statement', authenticate, getMonthlyStatement);

module.exports = router;

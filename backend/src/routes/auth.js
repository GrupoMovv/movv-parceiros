const router = require('express').Router();
const { login, me, changePassword, forceChangePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);
router.put('/force-change-password', authenticate, forceChangePassword);

module.exports = router;

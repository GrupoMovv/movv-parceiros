const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listPayments, registerPayment, getPendingByPartner } = require('../controllers/paymentController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `receipt_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authenticate, listPayments);
router.get('/pending', authenticate, requireAdmin, getPendingByPartner);
router.post('/', authenticate, requireAdmin, upload.single('receipt'), registerPayment);

module.exports = router;

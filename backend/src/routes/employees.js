const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  listEmployees, createEmployee, updateEmployee, toggleEmployee, resendCredentials,
} = require('../controllers/employeeController');

router.get('/',             authenticate, listEmployees);
router.post('/',            authenticate, createEmployee);
router.patch('/:id',        authenticate, updateEmployee);
router.patch('/:id/toggle', authenticate, toggleEmployee);
router.post('/:id/resend',  authenticate, resendCredentials);

module.exports = router;

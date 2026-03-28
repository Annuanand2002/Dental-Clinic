const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const {
  dashboard,
  createBill,
  listBills,
  getBill,
  createPayment,
  listPayments,
  createExpense,
  listExpenses,
  ledger
} = require('../controllers/financialController');

const router = express.Router();

router.get('/dashboard', authRequired, requireElevatedRole, dashboard);
router.get('/bills', authRequired, listBills);
router.post('/bills', authRequired, createBill);
router.get('/bills/:id', authRequired, getBill);
router.get('/payments', authRequired, listPayments);
router.post('/payments', authRequired, createPayment);
router.get('/expenses', authRequired, listExpenses);
router.post('/expenses', authRequired, createExpense);
router.get('/ledger', authRequired, ledger);

module.exports = router;

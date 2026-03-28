const repo = require('../repositories/mysqlFinancialRepository');

async function dashboard(req, res, next) {
  try {
    const data = await repo.getDashboardSummary({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function createBill(req, res, next) {
  try {
    const result = await repo.createBill(req.body || {});
    return res.status(201).json({ message: 'Bill created', ...result });
  } catch (err) {
    return next(err);
  }
}

async function listBills(req, res, next) {
  try {
    const result = await repo.listBills(req.query.page, req.query.limit);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getBill(req, res, next) {
  try {
    const id = Number(req.params.id);
    const bill = await repo.getBillById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    return res.json({ bill });
  } catch (err) {
    return next(err);
  }
}

async function createPayment(req, res, next) {
  try {
    const result = await repo.createPayment(req.body || {});
    return res.status(201).json({ message: 'Payment recorded', ...result });
  } catch (err) {
    return next(err);
  }
}

async function listPayments(req, res, next) {
  try {
    const result = await repo.listPayments(req.query.page, req.query.limit);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const result = await repo.createExpense(req.body || {});
    return res.status(201).json({ message: 'Expense recorded', ...result });
  } catch (err) {
    return next(err);
  }
}

async function listExpenses(req, res, next) {
  try {
    const result = await repo.listExpenses(req.query.page, req.query.limit);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function ledger(req, res, next) {
  try {
    const result = await repo.listLedger(req.query.page, req.query.limit, {
      type: req.query.type,
      category: req.query.category,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  dashboard,
  createBill,
  listBills,
  getBill,
  createPayment,
  listPayments,
  createExpense,
  listExpenses,
  ledger
};

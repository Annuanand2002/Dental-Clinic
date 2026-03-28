const { getPool } = require('../../../../core/db/pool');

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function getPaidTotal(connection, billingId) {
  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE billing_id = ?`,
    [billingId]
  );
  return Number(rows?.[0]?.s || 0);
}

async function updateBillingStatus(connection, billingId) {
  const [rows] = await connection.query(`SELECT final_amount FROM billing WHERE id = ? FOR UPDATE`, [billingId]);
  if (!rows?.[0]) return;
  const finalAmount = Number(rows[0].final_amount);
  const paid = await getPaidTotal(connection, billingId);
  let status = 'pending';
  if (paid <= 0.001) status = 'pending';
  else if (paid + 0.009 >= finalAmount) status = 'paid';
  else status = 'partial';
  await connection.query(`UPDATE billing SET status = ? WHERE id = ?`, [status, billingId]);
}

/**
 * Create invoice + line items (single DB transaction).
 */
async function createBill(payload) {
  const pool = getPool();
  const patientId = Number(payload.patientId);
  const appointmentId =
    payload.appointmentId != null && payload.appointmentId !== '' ? Number(payload.appointmentId) : null;
  const billDate = payload.billDate ? String(payload.billDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const discount = Math.max(0, Number(payload.discount) || 0);

  if (!patientId) {
    const err = new Error('patientId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!items.length) {
    const err = new Error('At least one line item is required');
    err.statusCode = 400;
    throw err;
  }

  let lineTotal = 0;
  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const price = Math.max(0, Number(it.price) || 0);
    lineTotal += qty * price;
  }
  const totalAmount = Math.round(lineTotal * 100) / 100;
  const finalAmount = Math.max(0, Math.round((totalAmount - discount) * 100) / 100);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (appointmentId) {
      const [ap] = await connection.query(
        `SELECT id FROM appointment WHERE id = ? AND patient_id = ? LIMIT 1`,
        [appointmentId, patientId]
      );
      if (!ap?.[0]) {
        const err = new Error('Appointment not found for this patient');
        err.statusCode = 400;
        throw err;
      }
    }

    const [ins] = await connection.query(
      `INSERT INTO billing (patient_id, appointment_id, total_amount, discount, final_amount, status, bill_date)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [patientId, appointmentId, totalAmount, discount, finalAmount, billDate]
    );
    const billId = ins.insertId;

    for (const it of items) {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.price) || 0);
      const name = String(it.itemName || it.name || 'Item').trim() || 'Item';
      await connection.query(
        `INSERT INTO billing_items (billing_id, item_name, quantity, price) VALUES (?, ?, ?, ?)`,
        [billId, name, qty, price]
      );
    }

    await connection.commit();
    return { billId, totalAmount, discount, finalAmount };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listBills(pageInput, limitInput) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM billing`);
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT
       b.id,
       b.patient_id AS patientId,
       b.appointment_id AS appointmentId,
       b.total_amount AS totalAmount,
       b.discount,
       b.final_amount AS finalAmount,
       b.status,
       b.bill_date AS billDate,
       b.created_at AS createdAt,
       u.username AS patientName,
       COALESCE(pay.paid, 0) AS paidAmount
     FROM billing b
     INNER JOIN patient pt ON pt.id = b.patient_id
     INNER JOIN users u ON u.id = pt.user_id
     LEFT JOIN (
       SELECT billing_id, SUM(amount) AS paid FROM payments GROUP BY billing_id
     ) pay ON pay.billing_id = b.id
     ORDER BY b.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const bills = (rows || []).map((r) => ({
    id: r.id,
    patientId: r.patientId,
    patientName: r.patientName || '',
    appointmentId: r.appointmentId,
    totalAmount: Number(r.totalAmount),
    discount: Number(r.discount),
    finalAmount: Number(r.finalAmount),
    status: r.status,
    billDate: r.billDate ? String(r.billDate).slice(0, 10) : '',
    paidAmount: Number(r.paidAmount),
    createdAt: r.createdAt
  }));

  return {
    bills,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

async function getBillById(billId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
       b.*,
       u.username AS patientName
     FROM billing b
     INNER JOIN patient pt ON pt.id = b.patient_id
     INNER JOIN users u ON u.id = pt.user_id
     WHERE b.id = ?`,
    [billId]
  );
  if (!rows?.[0]) return null;
  const b = rows[0];
  const [items] = await pool.query(
    `SELECT id, item_name AS itemName, quantity, price FROM billing_items WHERE billing_id = ? ORDER BY id`,
    [billId]
  );
  const [paidRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE billing_id = ?`,
    [billId]
  );
  return {
    id: b.id,
    patientId: b.patient_id,
    patientName: b.patientName || '',
    appointmentId: b.appointment_id,
    totalAmount: Number(b.total_amount),
    discount: Number(b.discount),
    finalAmount: Number(b.final_amount),
    status: b.status,
    billDate: b.bill_date ? String(b.bill_date).slice(0, 10) : '',
    paidAmount: Number(paidRows?.[0]?.s || 0),
    items: (items || []).map((i) => ({
      id: i.id,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      price: Number(i.price)
    }))
  };
}

/**
 * Create payment + income transaction + billing status (single DB transaction).
 */
async function createPayment(payload) {
  const pool = getPool();
  const billingId = Number(payload.billingId);
  const amount = Number(payload.amount);
  const method = String(payload.paymentMethod || 'cash');
  const paymentDate = payload.paymentDate
    ? String(payload.paymentDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const validMethods = ['cash', 'card', 'upi', 'bank'];
  if (!validMethods.includes(method)) {
    const err = new Error('paymentMethod must be cash, card, upi, or bank');
    err.statusCode = 400;
    throw err;
  }
  if (!billingId || amount <= 0) {
    const err = new Error('billingId and positive amount are required');
    err.statusCode = 400;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [brows] = await connection.query(
      `SELECT id, final_amount FROM billing WHERE id = ? FOR UPDATE`,
      [billingId]
    );
    if (!brows?.[0]) {
      const err = new Error('Bill not found');
      err.statusCode = 404;
      throw err;
    }
    const finalAmount = Number(brows[0].final_amount);
    const paidBefore = await getPaidTotal(connection, billingId);
    const remaining = Math.round((finalAmount - paidBefore) * 100) / 100;
    if (amount > remaining + 0.01) {
      const err = new Error(`Payment exceeds remaining balance (${remaining})`);
      err.statusCode = 400;
      throw err;
    }

    const [pins] = await connection.query(
      `INSERT INTO payments (billing_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)`,
      [billingId, amount, method, paymentDate]
    );
    const paymentId = pins.insertId;

    await connection.query(
      `INSERT INTO transactions (type, amount, category, reference_type, reference_id, payment_method, transaction_date)
       VALUES ('income', ?, 'patient_payment', 'payment', ?, ?, ?)`,
      [amount, paymentId, method, paymentDate]
    );

    await updateBillingStatus(connection, billingId);

    await connection.commit();
    return { paymentId, billingId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listPayments(pageInput, limitInput) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM payments`);
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT
       p.id,
       p.billing_id AS billingId,
       p.amount,
       p.payment_method AS paymentMethod,
       p.payment_date AS paymentDate,
       p.created_at AS createdAt,
       u.username AS patientName,
       b.final_amount AS billFinalAmount
     FROM payments p
     INNER JOIN billing b ON b.id = p.billing_id
     INNER JOIN patient pt ON pt.id = b.patient_id
     INNER JOIN users u ON u.id = pt.user_id
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return {
    payments: (rows || []).map((r) => ({
      id: r.id,
      billingId: r.billingId,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod,
      paymentDate: r.paymentDate ? String(r.paymentDate).slice(0, 10) : '',
      patientName: r.patientName || '',
      billFinalAmount: Number(r.billFinalAmount),
      createdAt: r.createdAt
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

/**
 * Expense + expense transaction; optional inventory stock + purchase in same transaction.
 */
async function createExpense(payload) {
  const pool = getPool();
  const title = String(payload.title || '').trim();
  const amount = Number(payload.amount);
  const category = String(payload.category || 'general').trim();
  const method = String(payload.paymentMethod || 'cash');
  const expenseDate = payload.expenseDate
    ? String(payload.expenseDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const description = payload.description != null ? String(payload.description) : null;

  const validMethods = ['cash', 'card', 'upi', 'bank'];
  if (!validMethods.includes(method)) {
    const err = new Error('paymentMethod must be cash, card, upi, or bank');
    err.statusCode = 400;
    throw err;
  }
  if (!title || !amount || amount <= 0) {
    const err = new Error('title and positive amount are required');
    err.statusCode = 400;
    throw err;
  }

  const inv = payload.inventoryPurchase;
  const linkInventory = inv && Number(inv.itemId) && Number(inv.quantity) > 0;
  let invItemId = null;
  let invQty = 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let stockId = null;
    if (linkInventory) {
      invItemId = Number(inv.itemId);
      invQty = Math.floor(Number(inv.quantity));
      const itemId = invItemId;
      const qty = invQty;
      const linePrice = Number(inv.purchasePrice != null ? inv.purchasePrice : amount);
      if (Math.abs(linePrice - amount) > 0.02) {
        const err = new Error('Expense amount must match inventory purchase total');
        err.statusCode = 400;
        throw err;
      }

      const [it] = await connection.query(
        `SELECT id FROM inventory_item WHERE id = ? AND is_active = 1 LIMIT 1`,
        [itemId]
      );
      if (!it?.[0]) {
        const err = new Error('Inventory item not found or inactive');
        err.statusCode = 404;
        throw err;
      }

      const [sins] = await connection.query(
        `INSERT INTO inventory_stock (
          item_id, quantity, batch_number, expiry_date, purchase_date, purchase_price, supplier_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          qty,
          inv.batchNumber || null,
          inv.expiryDate || null,
          inv.purchaseDate || expenseDate || null,
          linePrice,
          inv.supplierName || null
        ]
      );
      stockId = sins.insertId;
    }

    const [eins] = await connection.query(
      `INSERT INTO expense (
        title, amount, category, payment_method, expense_date,
        reference_type, reference_id, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        amount,
        category,
        method,
        expenseDate,
        stockId ? 'inventory_stock' : null,
        stockId,
        description
      ]
    );
    const expenseId = eins.insertId;

    if (stockId && invItemId) {
      await connection.query(
        `INSERT INTO stock_movement (item_id, type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'IN', ?, 'expense', ?, ?)`,
        [invItemId, invQty, expenseId, title]
      );
    }

    await connection.query(
      `INSERT INTO transactions (type, amount, category, reference_type, reference_id, payment_method, transaction_date)
       VALUES ('expense', ?, ?, 'expense', ?, ?, ?)`,
      [amount, category, expenseId, method, expenseDate]
    );

    await connection.commit();
    return { expenseId, stockId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listExpenses(pageInput, limitInput) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM expense`);
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT id, title, amount, category, payment_method AS paymentMethod, expense_date AS expenseDate,
            reference_type AS referenceType, reference_id AS referenceId, description, created_at AS createdAt
     FROM expense
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return {
    expenses: (rows || []).map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      category: r.category || '',
      paymentMethod: r.paymentMethod,
      expenseDate: r.expenseDate ? String(r.expenseDate).slice(0, 10) : '',
      referenceType: r.referenceType || '',
      referenceId: r.referenceId != null ? Number(r.referenceId) : null,
      description: r.description || '',
      createdAt: r.createdAt
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

async function listLedger(pageInput, limitInput, filters = {}) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const type = (filters.type || '').trim();
  const category = (filters.category || '').trim();
  const fromDate = (filters.fromDate || '').trim();
  const toDate = (filters.toDate || '').trim();

  const parts = [];
  const params = [];
  if (type === 'income' || type === 'expense') {
    parts.push('t.type = ?');
    params.push(type);
  }
  if (category) {
    parts.push('t.category LIKE ?');
    params.push(`%${category}%`);
  }
  if (fromDate) {
    parts.push('t.transaction_date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    parts.push('t.transaction_date <= ?');
    params.push(toDate);
  }
  const whereSql = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM transactions t ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT t.id, t.type, t.amount, t.category, t.reference_type AS referenceType, t.reference_id AS referenceId,
            t.payment_method AS paymentMethod, t.transaction_date AS transactionDate, t.created_at AS createdAt
     FROM transactions t
     ${whereSql}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    entries: (rows || []).map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      category: r.category || '',
      referenceType: r.referenceType || '',
      referenceId: r.referenceId != null ? Number(r.referenceId) : null,
      paymentMethod: r.paymentMethod || '',
      transactionDate: r.transactionDate ? String(r.transactionDate).slice(0, 10) : '',
      createdAt: r.createdAt
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

function parseISODate(s) {
  if (!s || typeof s !== 'string') return null;
  const p = s.slice(0, 10).split('-');
  if (p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eachMonthKeyInRange(fromStr, toStr) {
  const from = parseISODate(fromStr);
  const to = parseISODate(toStr);
  if (!from || !to || from > to) return [];
  const keys = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

/**
 * Dashboard: optional fromDate, toDate (YYYY-MM-DD). Defaults to first day of month
 * (today's month minus 5) through today → 6 calendar months of data.
 * KPI totals + charts + breakdowns all use the SAME [fromDate, toDate] on transaction_date.
 * Pending bill balance is always current (not filtered by this range).
 */
async function getDashboardSummary(options = {}) {
  const pool = getPool();

  const today = new Date();
  const defaultTo = formatISODate(today);
  const defaultFrom = formatISODate(new Date(today.getFullYear(), today.getMonth() - 5, 1));

  let fromDate = (options.fromDate && String(options.fromDate).trim()) || defaultFrom;
  let toDate = (options.toDate && String(options.toDate).trim()) || defaultTo;

  const fromD = parseISODate(fromDate);
  const toD = parseISODate(toDate);
  if (!fromD || !toD || fromD > toD) {
    const err = new Error('Invalid fromDate / toDate');
    err.statusCode = 400;
    throw err;
  }

  const maxSpanDays = 366 * 3;
  if ((toD - fromD) / 864e5 > maxSpanDays) {
    const err = new Error('Date range cannot exceed 3 years');
    err.statusCode = 400;
    throw err;
  }

  fromDate = formatISODate(fromD);
  toDate = formatISODate(toD);

  const [inc] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
     WHERE type = 'income' AND transaction_date >= ? AND transaction_date <= ?`,
    [fromDate, toDate]
  );
  const [exp] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
     WHERE type = 'expense' AND transaction_date >= ? AND transaction_date <= ?`,
    [fromDate, toDate]
  );
  const totalIncome = Number(inc?.[0]?.s || 0);
  const totalExpense = Number(exp?.[0]?.s || 0);
  const balance = Math.round((totalIncome - totalExpense) * 100) / 100;

  const [pendingRows] = await pool.query(`
    SELECT COALESCE(SUM(GREATEST(b.final_amount - COALESCE(p.paid, 0), 0)), 0) AS pending
    FROM billing b
    LEFT JOIN (
      SELECT billing_id, SUM(amount) AS paid FROM payments GROUP BY billing_id
    ) p ON p.billing_id = b.id
    WHERE b.status IN ('pending', 'partial')
  `);
  const pendingAmount = Number(pendingRows?.[0]?.pending || 0);

  const [chartRows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(transaction_date, '%Y-%m') AS ym,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
    FROM transactions
    WHERE transaction_date >= ? AND transaction_date <= ?
    GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
    ORDER BY ym ASC
  `,
    [fromDate, toDate]
  );

  const byMonth = new Map();
  for (const r of chartRows || []) {
    byMonth.set(r.ym, { income: Number(r.income), expense: Number(r.expense) });
  }

  const monthKeys = eachMonthKeyInRange(fromDate, toDate);
  const chart = monthKeys.map((ym) => {
    const row = byMonth.get(ym) || { income: 0, expense: 0 };
    const income = row.income;
    const expense = row.expense;
    return {
      month: ym,
      income,
      expense,
      net: Math.round((income - expense) * 100) / 100
    };
  });

  const [methodRows] = await pool.query(
    `
    SELECT
      COALESCE(payment_method, 'other') AS method,
      COALESCE(SUM(amount), 0) AS amt
    FROM transactions
    WHERE type = 'income'
      AND transaction_date >= ? AND transaction_date <= ?
    GROUP BY COALESCE(payment_method, 'other')
    ORDER BY amt DESC
  `,
    [fromDate, toDate]
  );

  const [catRows] = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(TRIM(category), ''), '(uncategorized)') AS cat,
      COALESCE(SUM(amount), 0) AS amt
    FROM transactions
    WHERE type = 'expense'
      AND transaction_date >= ? AND transaction_date <= ?
    GROUP BY COALESCE(NULLIF(TRIM(category), ''), '(uncategorized)')
    ORDER BY amt DESC
  `,
    [fromDate, toDate]
  );

  const incomeByPaymentMethod = (methodRows || []).map((r) => ({
    method: String(r.method || 'other'),
    amount: Number(r.amt || 0)
  }));

  const expenseByCategory = (catRows || []).map((r) => ({
    category: String(r.cat || '(uncategorized)'),
    amount: Number(r.amt || 0)
  }));

  return {
    totalIncome,
    totalExpense,
    balance,
    pendingPayments: pendingAmount,
    chart,
    incomeByPaymentMethod,
    expenseByCategory,
    period: {
      fromDate,
      toDate
    }
  };
}

module.exports = {
  createBill,
  listBills,
  getBillById,
  createPayment,
  listPayments,
  createExpense,
  listExpenses,
  listLedger,
  getDashboardSummary
};

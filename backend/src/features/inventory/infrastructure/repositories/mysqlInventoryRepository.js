const { getPool } = require('../../../../core/db/pool');

function mapItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    unit: row.unit || '',
    minStock: row.min_stock != null ? Number(row.min_stock) : 0,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalQuantity: row.total_quantity != null ? Number(row.total_quantity) : undefined
  };
}

function mapStockRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    quantity: Number(row.quantity),
    batchNumber: row.batch_number || '',
    expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : null,
    purchaseDate: row.purchase_date ? String(row.purchase_date).slice(0, 10) : null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    supplierName: row.supplier_name || '',
    createdAt: row.created_at
  };
}

function mapMovementRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name || '',
    type: row.type,
    quantity: Number(row.quantity),
    referenceType: row.reference_type || '',
    referenceId: row.reference_id != null ? Number(row.reference_id) : null,
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function listItems(pageInput, limitInput, searchInput, includeTotals = true, categoryInput = null) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(searchInput || '').trim();
  const cat = String(categoryInput || '').trim();
  const validCat = ['consumable', 'medicine', 'equipment'].includes(cat) ? cat : '';

  const conditions = [];
  const whereParams = [];
  if (q) {
    conditions.push('(i.name LIKE ? OR i.category LIKE ? OR IFNULL(i.description,\'\') LIKE ?)');
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (validCat) {
    conditions.push('i.category = ?');
    whereParams.push(validCat);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM inventory_item i ${whereSql}`,
    whereParams
  );
  const total = Number(countRows?.[0]?.total || 0);

  const totalSelect = includeTotals
    ? `, COALESCE((
         SELECT SUM(s.quantity) FROM inventory_stock s WHERE s.item_id = i.id
       ), 0) AS total_quantity`
    : '';

  const [rows] = await pool.query(
    `SELECT i.id, i.name, i.category, i.description, i.unit, i.min_stock, i.is_active, i.created_at, i.updated_at
     ${totalSelect}
     FROM inventory_item i
     ${whereSql}
     ORDER BY i.id DESC
     LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );

  return {
    rows: (rows || []).map(mapItemRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

async function getItemById(itemId) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM inventory_item WHERE id = ? LIMIT 1', [itemId]);
  if (!rows || !rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description || '',
    unit: r.unit || '',
    minStock: r.min_stock != null ? Number(r.min_stock) : 0,
    isActive: !!r.is_active
  };
}

async function createItem(payload) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO inventory_item (name, category, description, unit, min_stock, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.category,
      payload.description || null,
      payload.unit || null,
      payload.minStock != null ? Number(payload.minStock) : 0,
      payload.isActive !== false ? 1 : 0
    ]
  );
  return Number(result.insertId);
}

async function updateItem(itemId, payload) {
  const pool = getPool();
  const fields = [];
  const values = [];
  if (payload.name !== undefined) {
    fields.push('name = ?');
    values.push(payload.name);
  }
  if (payload.category !== undefined) {
    fields.push('category = ?');
    values.push(payload.category);
  }
  if (payload.description !== undefined) {
    fields.push('description = ?');
    values.push(payload.description);
  }
  if (payload.unit !== undefined) {
    fields.push('unit = ?');
    values.push(payload.unit);
  }
  if (payload.minStock !== undefined) {
    fields.push('min_stock = ?');
    values.push(Number(payload.minStock));
  }
  if (payload.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(payload.isActive ? 1 : 0);
  }
  if (!fields.length) return;
  values.push(itemId);
  await pool.query(`UPDATE inventory_item SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteItem(itemId) {
  const pool = getPool();
  await pool.query('DELETE FROM inventory_item WHERE id = ?', [itemId]);
}

/**
 * Purchase: insert batch + IN movement in one transaction.
 */
async function addPurchaseStock(payload) {
  const pool = getPool();
  const itemId = Number(payload.itemId);
  const quantity = Number(payload.quantity);
  if (!itemId || quantity <= 0 || !Number.isInteger(quantity)) {
    const err = new Error('Valid itemId and positive integer quantity are required');
    err.statusCode = 400;
    throw err;
  }

  const item = await getItemById(itemId);
  if (!item || !item.isActive) {
    const err = new Error('Item not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [ins] = await connection.query(
      `INSERT INTO inventory_stock (
        item_id, quantity, batch_number, expiry_date, purchase_date, purchase_price, supplier_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        quantity,
        payload.batchNumber || null,
        payload.expiryDate || null,
        payload.purchaseDate || null,
        payload.purchasePrice != null && payload.purchasePrice !== '' ? Number(payload.purchasePrice) : null,
        payload.supplierName || null
      ]
    );

    await connection.query(
      `INSERT INTO stock_movement (item_id, type, quantity, reference_type, reference_id, notes)
       VALUES (?, 'IN', ?, ?, ?, ?)`,
      [
        itemId,
        quantity,
        payload.referenceType || 'purchase',
        payload.referenceId != null ? Number(payload.referenceId) : null,
        payload.notes || null
      ]
    );

    await connection.commit();
    return { stockId: ins.insertId, itemId, quantity };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * FIFO by COALESCE(purchase_date, DATE(created_at)), then created_at, then id.
 */
async function consumeStockFifo(payload) {
  const pool = getPool();
  const itemId = Number(payload.itemId);
  let need = Number(payload.quantity);
  if (!itemId || need <= 0 || !Number.isInteger(need)) {
    const err = new Error('Valid itemId and positive integer quantity are required');
    err.statusCode = 400;
    throw err;
  }

  const item = await getItemById(itemId);
  if (!item || !item.isActive) {
    const err = new Error('Item not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [batches] = await connection.query(
      `SELECT id, quantity
       FROM inventory_stock
       WHERE item_id = ? AND quantity > 0
       ORDER BY COALESCE(purchase_date, DATE(created_at)) ASC, created_at ASC, id ASC
       FOR UPDATE`,
      [itemId]
    );

    let available = (batches || []).reduce((s, b) => s + Number(b.quantity), 0);
    if (available < need) {
      const err = new Error(`Insufficient stock: need ${need}, available ${available}`);
      err.code = 'INSUFFICIENT_STOCK';
      err.statusCode = 400;
      err.available = available;
      throw err;
    }

    let remaining = need;
    for (const batch of batches || []) {
      if (remaining <= 0) break;
      const q = Number(batch.quantity);
      const take = Math.min(q, remaining);
      const newQ = q - take;
      await connection.query('UPDATE inventory_stock SET quantity = ? WHERE id = ?', [newQ, batch.id]);
      remaining -= take;
    }

    await connection.query(
      `INSERT INTO stock_movement (item_id, type, quantity, reference_type, reference_id, notes)
       VALUES (?, 'OUT', ?, ?, ?, ?)`,
      [
        itemId,
        need,
        payload.referenceType || 'manual',
        payload.referenceId != null ? Number(payload.referenceId) : null,
        payload.notes || null
      ]
    );

    await connection.commit();
    return { itemId, quantity: need };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getTotalStockByItem(itemId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_stock WHERE item_id = ?`,
    [itemId]
  );
  return Number(rows?.[0]?.total || 0);
}

/**
 * Per-item totals, low-stock flag, expiring batches within N days.
 */
async function getInventorySummary(options = {}) {
  const pool = getPool();
  const expiringDays = Math.max(1, Number(options.expiringWithinDays) || 30);

  const [items] = await pool.query(`
    SELECT
      i.id,
      i.name,
      i.category,
      i.unit,
      i.min_stock,
      COALESCE(t.total_qty, 0) AS total_quantity
    FROM inventory_item i
    LEFT JOIN (
      SELECT item_id, SUM(quantity) AS total_qty
      FROM inventory_stock
      GROUP BY item_id
    ) t ON t.item_id = i.id
    WHERE i.is_active = 1
    ORDER BY i.name
  `);

  const summary = (items || []).map((row) => {
    const total = Number(row.total_quantity || 0);
    const min = Number(row.min_stock || 0);
    return {
      itemId: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit || '',
      minStock: min,
      totalQuantity: total,
      isLowStock: total < min
    };
  });

  const lowStockItems = summary.filter((s) => s.isLowStock);

  const [expiring] = await pool.query(
    `SELECT
       s.id AS stock_id,
       s.item_id,
       i.name AS item_name,
       s.quantity,
       s.batch_number,
       s.expiry_date,
       s.purchase_date
     FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id
     WHERE s.quantity > 0
       AND s.expiry_date IS NOT NULL
       AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND s.expiry_date >= CURDATE()
     ORDER BY s.expiry_date ASC, s.id ASC`,
    [expiringDays]
  );

  return {
    items: summary,
    lowStockItems,
    expiringWithinDays: expiringDays,
    expiringBatches: (expiring || []).map((r) => ({
      stockId: r.stock_id,
      itemId: r.item_id,
      itemName: r.item_name,
      quantity: Number(r.quantity),
      batchNumber: r.batch_number || '',
      expiryDate: r.expiry_date ? String(r.expiry_date).slice(0, 10) : null,
      purchaseDate: r.purchase_date ? String(r.purchase_date).slice(0, 10) : null
    }))
  };
}

async function listStockBatches(itemId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM inventory_stock WHERE item_id = ? ORDER BY COALESCE(purchase_date, DATE(created_at)) ASC, id ASC`,
    [itemId]
  );
  return (rows || []).map(mapStockRow);
}

async function listMovements(pageInput, limitInput, filters = {}) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const itemId = filters.itemId != null && filters.itemId !== '' ? Number(filters.itemId) : null;
  const fromDate = filters.fromDate ? String(filters.fromDate).trim() : '';
  const toDate = filters.toDate ? String(filters.toDate).trim() : '';

  const parts = [];
  const params = [];
  if (itemId) {
    parts.push('m.item_id = ?');
    params.push(itemId);
  }
  if (fromDate) {
    parts.push('DATE(m.created_at) >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    parts.push('DATE(m.created_at) <= ?');
    params.push(toDate);
  }
  const whereSql = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM stock_movement m ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT m.*, i.name AS item_name
     FROM stock_movement m
     INNER JOIN inventory_item i ON i.id = m.item_id
     ${whereSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    movements: (rows || []).map(mapMovementRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

module.exports = {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  addPurchaseStock,
  consumeStockFifo,
  getTotalStockByItem,
  getInventorySummary,
  listStockBatches,
  listMovements
};

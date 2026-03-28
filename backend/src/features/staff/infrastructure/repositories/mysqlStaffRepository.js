const { getPool } = require('../../../../core/db/pool');

function mapStaffRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    userAccountActive: !!row.user_is_active,
    staffType: row.staff_type || 'other',
    department: row.department || '',
    canLogin: !!row.can_login,
    isActive: !!row.is_active,
    joiningDate: row.joining_date ? String(row.joining_date).slice(0, 10) : '',
    salary: row.salary != null ? Number(row.salary) : null,
    notes: row.notes || '',
    profileImage: row.profile_image || ''
  };
}

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function saveProfileImage(connection, existingAttachmentId, profileImageBase64, actorId) {
  if (!profileImageBase64 || typeof profileImageBase64 !== 'string') {
    return existingAttachmentId || null;
  }

  const [result] = await connection.query(
    `INSERT INTO attachment (file_name, file_type, base64_data, created_by)
     VALUES (?, ?, ?, ?)`,
    [`staff-profile-${Date.now()}`, 'image/*', profileImageBase64, actorId || null]
  );

  if (existingAttachmentId) {
    await connection.query('DELETE FROM attachment WHERE id = ?', [existingAttachmentId]);
  }

  return result.insertId;
}

async function getStaffRoleId(connection) {
  const [roles] = await connection.query('SELECT id FROM user_role WHERE role_name = ? LIMIT 1', ['Staff']);
  if (!roles || !roles[0]) {
    throw new Error('Staff role does not exist in user_role table');
  }
  return Number(roles[0].id);
}

function computeUserIsActive(payload) {
  const canLogin = payload.canLogin !== false && payload.canLogin !== 0;
  const isActiveStaff = payload.isActive !== false && payload.isActive !== 0;
  return canLogin && isActiveStaff ? 1 : 0;
}

async function listStaff(pageInput, limitInput, searchInput) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(searchInput || '').trim();
  const whereSql = q
    ? `WHERE (
        u.username LIKE ?
        OR u.email LIKE ?
        OR s.department LIKE ?
        OR s.staff_type LIKE ?
      )`
    : '';
  const whereParams = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [];

  const [rows] = await pool.query(
    `WITH base AS (
      SELECT
        s.id,
        s.user_id,
        u.username,
        u.email,
        u.is_active AS user_is_active,
        s.staff_type,
        s.department,
        s.can_login,
        s.is_active,
        s.joining_date,
        s.salary,
        s.notes,
        a.base64_data AS profile_image
      FROM staff s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN attachment a ON a.id = s.profile_image_id
      ${whereSql}
    )
    SELECT *, (SELECT COUNT(*) FROM base) AS _total
    FROM base
    ORDER BY id DESC
    LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );

  const total =
    rows && rows.length ? Number(rows[0]._total || 0) : 0;

  return {
    rows: (rows || []).map((row) => {
      const { _total, ...rest } = row;
      return mapStaffRow(rest);
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function createStaff(payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const staffRoleId = await getStaffRoleId(connection);

    const generatedPassword = `${String(payload.username || 'staff').toLowerCase().replace(/\s+/g, '')}@123`;
    const passwordToStore =
      typeof payload.password === 'string' && payload.password.trim() !== ''
        ? payload.password.trim()
        : generatedPassword;
    const userIsActive = computeUserIsActive(payload);

    const [userInsert] = await connection.query(
      `INSERT INTO users (username, email, password, role_id, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.username, payload.email, passwordToStore, staffRoleId, userIsActive]
    );

    const userId = userInsert.insertId;
    const profileImageId = await saveProfileImage(connection, null, payload.profileImage, actorId);

    const canLogin = payload.canLogin !== false && payload.canLogin !== 0;
    const isActiveStaff = payload.isActive !== false && payload.isActive !== 0;

    await connection.query(
      `INSERT INTO staff (
        user_id, staff_type, department, can_login, is_active,
        joining_date, salary, notes, profile_image_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.staffType || 'other',
        payload.department || null,
        canLogin ? 1 : 0,
        isActiveStaff ? 1 : 0,
        payload.joiningDate || null,
        payload.salary != null && payload.salary !== '' ? Number(payload.salary) : null,
        payload.notes || null,
        profileImageId
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateStaff(staffId, payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [staffRows] = await connection.query(
      'SELECT id, user_id, profile_image_id FROM staff WHERE id = ? LIMIT 1 FOR UPDATE',
      [staffId]
    );
    if (!staffRows || !staffRows[0]) {
      throw new Error('Staff not found');
    }
    const staff = staffRows[0];

    if (payload.username || payload.email) {
      const updates = [];
      const values = [];

      if (payload.username) {
        updates.push('username = ?');
        values.push(payload.username);
      }
      if (payload.email) {
        updates.push('email = ?');
        values.push(payload.email);
      }
      if (updates.length > 0) {
        values.push(staff.user_id);
        await connection.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      }
    }

    if (typeof payload.password === 'string' && payload.password.trim() !== '') {
      await connection.query('UPDATE users SET password = ? WHERE id = ?', [
        payload.password.trim(),
        staff.user_id
      ]);
    }

    const userIsActive = computeUserIsActive(payload);
    await connection.query('UPDATE users SET is_active = ? WHERE id = ?', [userIsActive, staff.user_id]);

    const profileImageId = await saveProfileImage(connection, staff.profile_image_id, payload.profileImage, actorId);

    const canLogin = payload.canLogin !== false && payload.canLogin !== 0;
    const isActiveStaff = payload.isActive !== false && payload.isActive !== 0;

    await connection.query(
      `UPDATE staff
       SET staff_type = ?,
           department = ?,
           can_login = ?,
           is_active = ?,
           joining_date = ?,
           salary = ?,
           notes = ?,
           profile_image_id = ?
       WHERE id = ?`,
      [
        payload.staffType || 'other',
        payload.department || null,
        canLogin ? 1 : 0,
        isActiveStaff ? 1 : 0,
        payload.joiningDate || null,
        payload.salary != null && payload.salary !== '' ? Number(payload.salary) : null,
        payload.notes || null,
        profileImageId,
        staffId
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteStaff(staffId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT user_id FROM staff WHERE id = ? LIMIT 1 FOR UPDATE', [staffId]);
    if (!rows || !rows[0]) {
      throw new Error('Staff not found');
    }
    await connection.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff
};

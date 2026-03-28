const { getPool } = require('../../../../core/db/pool');

function mapDoctorRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    userAccountActive: !!row.user_is_active,
    specialization: row.specialization || '',
    experience: row.experience ?? null,
    qualification: row.qualification || '',
    consultationFee: row.consultation_fee ?? null,
    availableTime: row.available_time || '',
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
    [`doctor-profile-${Date.now()}`, 'image/*', profileImageBase64, actorId || null]
  );

  if (existingAttachmentId) {
    await connection.query('DELETE FROM attachment WHERE id = ?', [existingAttachmentId]);
  }

  return result.insertId;
}

async function getDoctorRoleId(connection) {
  const [roles] = await connection.query('SELECT id FROM user_role WHERE role_name = ? LIMIT 1', ['Doctor']);
  if (!roles || !roles[0]) {
    throw new Error('Doctor role does not exist in user_role table');
  }
  return Number(roles[0].id);
}

async function listDoctors(pageInput, limitInput, searchInput, activeUsersOnly) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(searchInput || '').trim();
  const onlyActive =
    activeUsersOnly === true ||
    activeUsersOnly === 1 ||
    activeUsersOnly === '1' ||
    String(activeUsersOnly || '').toLowerCase() === 'true';

  const conditions = [];
  const whereParams = [];
  if (q) {
    conditions.push(
      '(u.username LIKE ? OR u.email LIKE ? OR d.specialization LIKE ? OR d.qualification LIKE ?)'
    );
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (onlyActive) {
    conditions.push('u.is_active = 1');
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `WITH base AS (
      SELECT
        d.id,
        d.user_id,
        u.username,
        u.email,
        u.is_active AS user_is_active,
        d.specialization,
        d.experience,
        d.qualification,
        d.consultation_fee,
        d.available_days,
        d.available_time,
        a.base64_data AS profile_image
      FROM doctor d
      INNER JOIN users u ON u.id = d.user_id
      LEFT JOIN attachment a ON a.id = d.profile_image_id
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
      return mapDoctorRow(rest);
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function createDoctor(payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const doctorRoleId = await getDoctorRoleId(connection);

    const generatedPassword = `${String(payload.username || 'doctor').toLowerCase().replace(/\s+/g, '')}@123`;

    const [userInsert] = await connection.query(
      `INSERT INTO users (username, email, password, role_id, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [payload.username, payload.email, generatedPassword, doctorRoleId]
    );

    const userId = userInsert.insertId;
    const profileImageId = await saveProfileImage(connection, null, payload.profileImage, actorId);

    await connection.query(
      `INSERT INTO doctor (
        user_id, specialization, experience, qualification, consultation_fee,
        available_days, available_time, profile_image_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.specialization || null,
        payload.experience ?? null,
        payload.qualification || null,
        payload.consultationFee ?? null,
        null,
        payload.availableTime || null,
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

  return listDoctors();
}

async function updateDoctor(doctorId, payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [doctorRows] = await connection.query(
      'SELECT id, user_id, profile_image_id FROM doctor WHERE id = ? LIMIT 1 FOR UPDATE',
      [doctorId]
    );
    if (!doctorRows || !doctorRows[0]) {
      throw new Error('Doctor not found');
    }
    const doctor = doctorRows[0];

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
        values.push(doctor.user_id);
        await connection.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      }
    }

    const profileImageId = await saveProfileImage(connection, doctor.profile_image_id, payload.profileImage, actorId);

    await connection.query(
      `UPDATE doctor
       SET specialization = ?,
           experience = ?,
           qualification = ?,
           consultation_fee = ?,
           available_days = ?,
           available_time = ?,
           profile_image_id = ?
       WHERE id = ?`,
      [
        payload.specialization || null,
        payload.experience ?? null,
        payload.qualification || null,
        payload.consultationFee ?? null,
        null,
        payload.availableTime || null,
        profileImageId,
        doctorId
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return listDoctors();
}

async function deleteDoctor(doctorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [doctorRows] = await connection.query('SELECT user_id FROM doctor WHERE id = ? LIMIT 1 FOR UPDATE', [doctorId]);
    if (!doctorRows || !doctorRows[0]) {
      throw new Error('Doctor not found');
    }
    await connection.query('DELETE FROM users WHERE id = ?', [doctorRows[0].user_id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  listDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor
};

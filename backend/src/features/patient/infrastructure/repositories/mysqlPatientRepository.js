const { getPool } = require('../../../../core/db/pool');
const { validateUploadPayload } = require('../../../../core/attachments/attachmentValidation');
const { insertAttachment } = require('../../../attachment/infrastructure/repositories/mysqlAttachmentRepository');

function mapPatientRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    userAccountActive: !!row.user_is_active,
    bloodGroup: row.blood_group || '',
    allergies: row.allergies || '',
    emergencyContact: row.emergency_contact || '',
    gender: row.gender || '',
    dateOfBirth: row.date_of_birth || '',
    mobile: row.mobile || '',
    alternateMobile: row.alternate_mobile || '',
    patientEmail: row.patient_email || '',
    addressLine1: row.address_line1 || '',
    addressLine2: row.address_line2 || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactNumber: row.emergency_contact_number || '',
    medicalHistory: row.medical_history || '',
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
    [`patient-profile-${Date.now()}`, 'image/*', profileImageBase64, actorId || null]
  );

  if (existingAttachmentId) {
    await connection.query('DELETE FROM attachment WHERE id = ?', [existingAttachmentId]);
  }

  return result.insertId;
}

async function getPatientRoleId(connection) {
  const [roles] = await connection.query('SELECT id FROM user_role WHERE role_name = ? LIMIT 1', ['Patient']);
  if (!roles || !roles[0]) {
    throw new Error('Patient role does not exist in user_role table');
  }
  return Number(roles[0].id);
}

async function listPatients(pageInput, limitInput, searchInput) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(searchInput || '').trim();
  const whereSql = q
    ? `WHERE (
        u.username LIKE ?
        OR u.email LIKE ?
        OR p.blood_group LIKE ?
        OR p.emergency_contact LIKE ?
      )`
    : '';
  const whereParams = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [];

  const [rows] = await pool.query(
    `WITH base AS (
      SELECT
        p.id,
        p.user_id,
        u.username,
        u.email,
        u.is_active AS user_is_active,
        p.blood_group,
        p.allergies,
        p.emergency_contact,
        p.gender,
        p.date_of_birth,
        p.mobile,
        p.alternate_mobile,
        p.email AS patient_email,
        p.address_line1,
        p.address_line2,
        p.city,
        p.state,
        p.pincode,
        p.emergency_contact_name,
        p.emergency_contact_number,
        p.medical_history,
        a.base64_data AS profile_image
      FROM patient p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN attachment a ON a.id = p.profile_image_id
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
      return mapPatientRow(rest);
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function createPatient(payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const patientRoleId = await getPatientRoleId(connection);

    const generatedPassword = `${String(payload.username || 'patient').toLowerCase().replace(/\s+/g, '')}@123`;

    const [userInsert] = await connection.query(
      `INSERT INTO users (username, email, password, role_id, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [payload.username, payload.email, generatedPassword, patientRoleId]
    );

    const userId = userInsert.insertId;
    const profileImageId = await saveProfileImage(connection, null, payload.profileImage, actorId);

    const [insertResult] = await connection.query(
      `INSERT INTO patient (
        user_id, blood_group, allergies, emergency_contact, gender, date_of_birth, mobile, alternate_mobile, email,
        address_line1, address_line2, city, state, pincode, emergency_contact_name, emergency_contact_number, medical_history,
        profile_image_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.bloodGroup || null,
        payload.allergies || null,
        payload.emergencyContact || null,
        payload.gender || null,
        payload.dateOfBirth || null,
        payload.mobile || null,
        payload.alternateMobile || null,
        payload.patientEmail || payload.email || null,
        payload.addressLine1 || null,
        payload.addressLine2 || null,
        payload.city || null,
        payload.state || null,
        payload.pincode || null,
        payload.emergencyContactName || null,
        payload.emergencyContactNumber || null,
        payload.medicalHistory || null,
        profileImageId
      ]
    );

    await connection.commit();
    return Number(insertResult.insertId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return null;
}

async function updatePatient(patientId, payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [patientRows] = await connection.query(
      'SELECT id, user_id, profile_image_id FROM patient WHERE id = ? LIMIT 1 FOR UPDATE',
      [patientId]
    );
    if (!patientRows || !patientRows[0]) {
      throw new Error('Patient not found');
    }
    const patient = patientRows[0];

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
        values.push(patient.user_id);
        await connection.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      }
    }

    const profileImageId = await saveProfileImage(connection, patient.profile_image_id, payload.profileImage, actorId);

    await connection.query(
      `UPDATE patient
       SET blood_group = ?,
           allergies = ?,
           emergency_contact = ?,
           gender = ?,
           date_of_birth = ?,
           mobile = ?,
           alternate_mobile = ?,
           email = ?,
           address_line1 = ?,
           address_line2 = ?,
           city = ?,
           state = ?,
           pincode = ?,
           emergency_contact_name = ?,
           emergency_contact_number = ?,
           medical_history = ?,
           profile_image_id = ?
       WHERE id = ?`,
      [
        payload.bloodGroup || null,
        payload.allergies || null,
        payload.emergencyContact || null,
        payload.gender || null,
        payload.dateOfBirth || null,
        payload.mobile || null,
        payload.alternateMobile || null,
        payload.patientEmail || payload.email || null,
        payload.addressLine1 || null,
        payload.addressLine2 || null,
        payload.city || null,
        payload.state || null,
        payload.pincode || null,
        payload.emergencyContactName || null,
        payload.emergencyContactNumber || null,
        payload.medicalHistory || null,
        profileImageId,
        patientId
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

async function deletePatient(patientId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [patientRows] = await connection.query('SELECT user_id FROM patient WHERE id = ? LIMIT 1 FOR UPDATE', [patientId]);
    if (!patientRows || !patientRows[0]) {
      throw new Error('Patient not found');
    }
    await connection.query('DELETE FROM attachment WHERE patient_id = ?', [patientId]);
    await connection.query('DELETE FROM users WHERE id = ?', [patientRows[0].user_id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listPatientMedicalRecords(patientId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, file_name, file_type, base64_data, created_date, patient_id,
            entity_type, entity_id, document_type, title, description, appointment_id
     FROM attachment
     WHERE patient_id = ?
     ORDER BY id DESC`,
    [patientId]
  );
  return (rows || []).map((row) => ({
    id: row.id,
    fileName: row.file_name || '',
    fileType: row.file_type || '',
    data: row.base64_data || '',
    createdDate: row.created_date || null,
    entityType: row.entity_type || null,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    documentType: row.document_type || null,
    title: row.title || null,
    description: row.description || null,
    appointmentId: row.appointment_id != null ? Number(row.appointment_id) : null
  }));
}

async function createPatientMedicalRecord(patientId, payload, actorId) {
  const v = validateUploadPayload({
    fileName: payload?.fileName,
    fileType: payload?.fileType,
    data: payload?.data,
    entityType: 'medical_record',
    entityId: patientId,
    documentType: payload?.documentType,
    title: payload?.title,
    description: payload?.description,
    appointmentId: payload?.appointmentId
  });
  if (!v.ok) {
    const err = new Error(v.message);
    err.statusCode = v.status;
    throw err;
  }
  return insertAttachment(v.value, actorId);
}

async function deletePatientMedicalRecord(patientId, recordId) {
  const pool = getPool();
  await pool.query('DELETE FROM attachment WHERE id = ? AND patient_id = ?', [recordId, patientId]);
}

module.exports = {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  listPatientMedicalRecords,
  createPatientMedicalRecord,
  deletePatientMedicalRecord
};

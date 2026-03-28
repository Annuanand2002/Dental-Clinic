const { getPool } = require('../../../../core/db/pool');

function mapAppointmentRow(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    title: row.title || '',
    description: row.description || '',
    color: row.color || 'green'
  };
}

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function listAppointments(pageInput, limitInput, filters = {}) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(filters.search || '').trim();
  const date = String(filters.date || '').trim();
  const month = String(filters.month || '').trim();

  const whereParts = [];
  const whereParams = [];

  if (q) {
    whereParts.push('(up.username LIKE ? OR ud.username LIKE ? OR a.title LIKE ? OR a.description LIKE ?)');
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (date) {
    whereParts.push('a.appointment_date = ?');
    whereParams.push(date);
  } else if (month) {
    whereParts.push("DATE_FORMAT(a.appointment_date, '%Y-%m') = ?");
    whereParams.push(month);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM appointment a
     INNER JOIN patient p ON p.id = a.patient_id
     INNER JOIN doctor d ON d.id = a.doctor_id
     INNER JOIN users up ON up.id = p.user_id
     INNER JOIN users ud ON ud.id = d.user_id
     ${whereSql}`,
    whereParams
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT
      a.id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      a.status,
      a.title,
      a.description,
      a.color,
      up.username AS patient_name,
      ud.username AS doctor_name
    FROM appointment a
    INNER JOIN patient p ON p.id = a.patient_id
    INNER JOIN doctor d ON d.id = a.doctor_id
    INNER JOIN users up ON up.id = p.user_id
    INNER JOIN users ud ON ud.id = d.user_id
    ${whereSql}
    ORDER BY a.appointment_date ASC, a.start_time ASC
    LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );
  return {
    rows: (rows || []).map(mapAppointmentRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function hasDoctorTimeConflict(doctorId, appointmentDate, startTime, endTime, excludeAppointmentId) {
  const pool = getPool();
  const sql = `
    SELECT id
    FROM appointment
    WHERE doctor_id = ?
      AND appointment_date = ?
      AND start_time < ?
      AND end_time > ?
      ${excludeAppointmentId ? 'AND id <> ?' : ''}
    LIMIT 1
  `;
  const params = excludeAppointmentId
    ? [doctorId, appointmentDate, endTime, startTime, excludeAppointmentId]
    : [doctorId, appointmentDate, endTime, startTime];
  const [rows] = await pool.query(sql, params);
  return !!(rows && rows[0]);
}

async function createAppointment(payload) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO appointment (
      patient_id, doctor_id, appointment_date, start_time, end_time, status, title, description, color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.patientId,
      payload.doctorId,
      payload.appointmentDate,
      payload.startTime,
      payload.endTime,
      payload.status || 'scheduled',
      payload.title || null,
      payload.description || null,
      payload.color || 'green'
    ]
  );
}

async function updateAppointment(appointmentId, payload) {
  const pool = getPool();
  await pool.query(
    `UPDATE appointment
     SET patient_id = ?,
         doctor_id = ?,
         appointment_date = ?,
         start_time = ?,
         end_time = ?,
         status = ?,
         title = ?,
         description = ?,
         color = ?
     WHERE id = ?`,
    [
      payload.patientId,
      payload.doctorId,
      payload.appointmentDate,
      payload.startTime,
      payload.endTime,
      payload.status || 'scheduled',
      payload.title || null,
      payload.description || null,
      payload.color || 'green',
      appointmentId
    ]
  );
}

async function deleteAppointment(appointmentId) {
  const pool = getPool();
  await pool.query('DELETE FROM appointment WHERE id = ?', [appointmentId]);
}

module.exports = {
  listAppointments,
  hasDoctorTimeConflict,
  createAppointment,
  updateAppointment,
  deleteAppointment
};

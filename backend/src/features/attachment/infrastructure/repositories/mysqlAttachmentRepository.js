const { getPool } = require('../../../../core/db/pool');
const { derivePatientIdColumn } = require('../../../../core/attachments/attachmentValidation');

function mapRowFull(row) {
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.file_name || '',
    fileType: row.file_type || '',
    data: row.base64_data || '',
    createdDate: row.created_date || null,
    patientId: row.patient_id != null ? Number(row.patient_id) : null,
    entityType: row.entity_type || null,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    documentType: row.document_type || null,
    title: row.title || null,
    description: row.description || null,
    appointmentId: row.appointment_id != null ? Number(row.appointment_id) : null
  };
}

function mapRowMeta(row) {
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.file_name || '',
    fileType: row.file_type || '',
    createdDate: row.created_date || null,
    patientId: row.patient_id != null ? Number(row.patient_id) : null,
    entityType: row.entity_type || null,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    documentType: row.document_type || null,
    title: row.title || null,
    description: row.description || null,
    appointmentId: row.appointment_id != null ? Number(row.appointment_id) : null
  };
}

/**
 * @param {object} payload - from validateUploadPayload.value
 * @param {number|null} actorId
 */
async function insertAttachment(payload, actorId) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO attachment (
      file_name, file_type, base64_data, created_by, patient_id,
      entity_type, entity_id, document_type, title, description, appointment_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.fileName,
      payload.fileType,
      payload.data,
      actorId || null,
      payload.patientId,
      payload.entityType,
      payload.entityId,
      payload.documentType,
      payload.title,
      payload.description,
      payload.appointmentId != null ? payload.appointmentId : null
    ]
  );
  return Number(result.insertId);
}

async function listAttachmentsByEntity(entityType, entityId, page, limit, includeData) {
  const pool = getPool();
  const offset = (page - 1) * limit;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM attachment WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId]
  );
  const total = Number(countRows?.[0]?.total || 0);

  const cols = includeData
    ? `id, file_name, file_type, base64_data, created_date, patient_id,
       entity_type, entity_id, document_type, title, description, appointment_id`
    : `id, file_name, file_type, created_date, patient_id,
       entity_type, entity_id, document_type, title, description, appointment_id`;

  const [rows] = await pool.query(
    `SELECT ${cols}
     FROM attachment
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [entityType, entityId, limit, offset]
  );

  const mapper = includeData ? mapRowFull : mapRowMeta;
  return {
    attachments: (rows || []).map(mapper),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function getAttachmentById(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, file_name, file_type, base64_data, created_date, patient_id,
            entity_type, entity_id, document_type, title, description, appointment_id
     FROM attachment WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapRowFull(rows && rows[0]);
}

async function browseAttachments(filters) {
  const pool = getPool();
  const page = filters.page;
  const limit = filters.limit;
  const offset = (page - 1) * limit;

  const where = ['entity_type IS NOT NULL'];
  const params = [];

  if (filters.entityType) {
    where.push('entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.entityId != null) {
    where.push('entity_id = ?');
    params.push(filters.entityId);
  }
  if (filters.documentType) {
    where.push('(document_type LIKE ? OR title LIKE ?)');
    const p = `%${filters.documentType}%`;
    params.push(p, p);
  }
  if (filters.fromDate) {
    where.push('DATE(created_date) >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push('DATE(created_date) <= ?');
    params.push(filters.toDate);
  }
  if (filters.appointmentId != null) {
    where.push('appointment_id = ?');
    params.push(filters.appointmentId);
  }

  const whereSql = where.join(' AND ');
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM attachment WHERE ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT id, file_name, file_type, created_date, patient_id,
            entity_type, entity_id, document_type, title, description, appointment_id
     FROM attachment
     WHERE ${whereSql}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    attachments: (rows || []).map(mapRowMeta),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function deleteAttachmentById(id) {
  const pool = getPool();
  const [result] = await pool.query('DELETE FROM attachment WHERE id = ?', [id]);
  return Number(result.affectedRows || 0) > 0;
}

/**
 * @param {number} id
 * @param {object} patch - from validateUpdatePayload.value merged in controller
 */
async function updateAttachmentById(id, patch) {
  const cur = await getAttachmentById(id);
  if (!cur) return null;

  const entityType = patch.entityType ?? cur.entityType;
  const entityId = patch.entityId ?? cur.entityId;
  if (!entityType || entityId == null) {
    const err = new Error('Attachment is missing entity metadata');
    err.statusCode = 400;
    throw err;
  }

  const fileName = patch.fileName ?? cur.fileName;
  const fileType = patch.fileType ?? cur.fileType;
  const data = patch.data ?? cur.data;
  const documentType = patch.documentType !== undefined ? patch.documentType : cur.documentType;
  const title = patch.title !== undefined ? patch.title : cur.title;
  const description = patch.description !== undefined ? patch.description : cur.description;
  const appointmentId =
    patch.appointmentId !== undefined ? patch.appointmentId : cur.appointmentId ?? null;
  const patientId = derivePatientIdColumn(entityType, entityId);

  const pool = getPool();
  await pool.query(
    `UPDATE attachment SET
      file_name = ?, file_type = ?, base64_data = ?,
      entity_type = ?, entity_id = ?,
      document_type = ?, title = ?, description = ?,
      appointment_id = ?, patient_id = ?
     WHERE id = ?`,
    [
      fileName,
      fileType,
      data,
      entityType,
      entityId,
      documentType,
      title,
      description,
      appointmentId,
      patientId,
      id
    ]
  );
  return getAttachmentById(id);
}

module.exports = {
  insertAttachment,
  listAttachmentsByEntity,
  browseAttachments,
  getAttachmentById,
  updateAttachmentById,
  deleteAttachmentById,
  mapRowFull,
  mapRowMeta
};

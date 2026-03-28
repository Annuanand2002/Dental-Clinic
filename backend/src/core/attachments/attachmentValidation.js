const {
  ENTITY_TYPES,
  MAX_DOCUMENT_TYPE_LEN,
  MAX_TITLE_LEN
} = require('./attachmentConstants');

function isValidEntityType(value) {
  return typeof value === 'string' && ENTITY_TYPES.includes(value);
}

function parsePositiveBigIntId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n;
}

/**
 * Optional patient_id for cascade delete when the document belongs to a patient.
 */
function derivePatientIdColumn(entityType, entityId) {
  if (entityType === 'patient' || entityType === 'medical_record') {
    return entityId;
  }
  return null;
}

function trimOrNull(s, maxLen) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (maxLen != null && t.length > maxLen) {
    return t.slice(0, maxLen);
  }
  return t;
}

/**
 * Validates upload body for generic attachment insert.
 * @returns {{ ok: true, value: object } | { ok: false, status: number, message: string }}
 */
function validateUploadPayload(body) {
  const b = body || {};
  const fileName = trimOrNull(b.fileName, 500) || `file-${Date.now()}`;
  const fileType = trimOrNull(b.fileType, 200) || 'application/octet-stream';
  const data = b.data;
  if (typeof data !== 'string' || data.trim() === '') {
    return { ok: false, status: 400, message: 'data (base64 file content) is required' };
  }

  const entityType = b.entityType;
  if (!isValidEntityType(entityType)) {
    return {
      ok: false,
      status: 400,
      message: `entityType must be one of: ${ENTITY_TYPES.join(', ')}`
    };
  }

  const entityId = parsePositiveBigIntId(b.entityId);
  if (entityId == null) {
    return { ok: false, status: 400, message: 'entityId must be a positive integer' };
  }

  const documentType = trimOrNull(b.documentType, MAX_DOCUMENT_TYPE_LEN);
  const title = trimOrNull(b.title, MAX_TITLE_LEN);
  const description =
    b.description == null || String(b.description).trim() === ''
      ? null
      : String(b.description).trim();

  let appointmentId = null;
  if (b.appointmentId != null && String(b.appointmentId).trim() !== '') {
    const aid = parsePositiveBigIntId(b.appointmentId);
    if (aid == null) {
      return { ok: false, status: 400, message: 'appointmentId must be a positive integer when provided' };
    }
    appointmentId = aid;
  }

  return {
    ok: true,
    value: {
      fileName,
      fileType,
      data: data.trim(),
      entityType,
      entityId,
      documentType,
      title,
      description,
      appointmentId,
      patientId: derivePatientIdColumn(entityType, entityId)
    }
  };
}

/**
 * Query params for listing by entity.
 */
function validateListQuery(query) {
  const q = query || {};
  const entityType = q.entityType;
  if (!isValidEntityType(entityType)) {
    return {
      ok: false,
      status: 400,
      message: `entityType must be one of: ${ENTITY_TYPES.join(', ')}`
    };
  }
  const entityId = parsePositiveBigIntId(q.entityId);
  if (entityId == null) {
    return { ok: false, status: 400, message: 'entityId must be a positive integer' };
  }
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
  return { ok: true, value: { entityType, entityId, page, limit } };
}

/**
 * Browse all document rows (entity metadata set) with optional filters.
 */
function validateBrowseQuery(query) {
  const q = query || {};
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));

  if (q.entityType != null && String(q.entityType).trim() !== '') {
    if (!isValidEntityType(q.entityType)) {
      return {
        ok: false,
        status: 400,
        message: `entityType must be one of: ${ENTITY_TYPES.join(', ')}`
      };
    }
  }

  let entityId = null;
  if (q.entityId != null && String(q.entityId).trim() !== '') {
    entityId = parsePositiveBigIntId(q.entityId);
    if (entityId == null) {
      return { ok: false, status: 400, message: 'entityId must be a positive integer when provided' };
    }
  }

  let appointmentId = null;
  if (q.appointmentId != null && String(q.appointmentId).trim() !== '') {
    appointmentId = parsePositiveBigIntId(q.appointmentId);
    if (appointmentId == null) {
      return { ok: false, status: 400, message: 'appointmentId must be a positive integer when provided' };
    }
  }

  const documentType = trimOrNull(q.documentType, MAX_DOCUMENT_TYPE_LEN);

  const fromDate = trimOrNull(q.fromDate, 32);
  const toDate = trimOrNull(q.toDate, 32);
  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return { ok: false, status: 400, message: 'fromDate must be YYYY-MM-DD' };
  }
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return { ok: false, status: 400, message: 'toDate must be YYYY-MM-DD' };
  }

  return {
    ok: true,
    value: {
      page,
      limit,
      entityType: q.entityType && String(q.entityType).trim() ? q.entityType : null,
      entityId,
      documentType,
      fromDate,
      toDate,
      appointmentId
    }
  };
}

/**
 * Partial update: at least one of metadata or file (data) fields.
 */
function validateUpdatePayload(body) {
  const b = body || {};
  const patch = {};

  if (b.documentType !== undefined) {
    patch.documentType = trimOrNull(b.documentType, MAX_DOCUMENT_TYPE_LEN);
  }
  if (b.title !== undefined) {
    patch.title = trimOrNull(b.title, MAX_TITLE_LEN);
  }
  if (b.description !== undefined) {
    patch.description =
      b.description == null || String(b.description).trim() === ''
        ? null
        : String(b.description).trim();
  }
  if (b.entityType !== undefined) {
    if (!isValidEntityType(b.entityType)) {
      return {
        ok: false,
        status: 400,
        message: `entityType must be one of: ${ENTITY_TYPES.join(', ')}`
      };
    }
    patch.entityType = b.entityType;
  }
  if (b.entityId !== undefined) {
    const eid = parsePositiveBigIntId(b.entityId);
    if (eid == null) {
      return { ok: false, status: 400, message: 'entityId must be a positive integer' };
    }
    patch.entityId = eid;
  }
  if (b.appointmentId !== undefined) {
    if (b.appointmentId === null || b.appointmentId === '') {
      patch.appointmentId = null;
    } else {
      const aid = parsePositiveBigIntId(b.appointmentId);
      if (aid == null) {
        return { ok: false, status: 400, message: 'appointmentId must be a positive integer when provided' };
      }
      patch.appointmentId = aid;
    }
  }
  if (b.data !== undefined && typeof b.data === 'string' && b.data.trim() !== '') {
    patch.data = b.data.trim();
    patch.fileName = trimOrNull(b.fileName, 500) || `file-${Date.now()}`;
    patch.fileType = trimOrNull(b.fileType, 200) || 'application/octet-stream';
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, message: 'No fields to update' };
  }
  if (patch.entityType != null && patch.entityId == null) {
    return { ok: false, status: 400, message: 'entityId is required when entityType is updated' };
  }
  if (patch.entityId != null && patch.entityType == null) {
    return { ok: false, status: 400, message: 'entityType is required when entityId is updated' };
  }

  return { ok: true, value: patch };
}

module.exports = {
  isValidEntityType,
  parsePositiveBigIntId,
  derivePatientIdColumn,
  validateUploadPayload,
  validateListQuery,
  validateBrowseQuery,
  validateUpdatePayload
};

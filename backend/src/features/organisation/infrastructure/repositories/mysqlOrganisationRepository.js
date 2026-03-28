const { getPool } = require('../../../../core/db/pool');

function mapOrganisationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.org_code,
    name: row.org_name || '',
    description: row.description || '',
    phone: row.phone_number || '',
    email: row.email || '',
    address: row.address || '',
    website: row.website || '',
    addSeal: Number(row.add_seal || 0) === 1,
    logo: row.logo_data || '',
    headerImage: row.header_data || '',
    footerImage: row.footer_data || '',
    sealImage: row.seal_data || ''
  };
}

function inferFileTypeFromDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,/.exec(dataUrl || '');
  return match ? match[1] : null;
}

async function upsertAttachment(connection, existingId, dataUrl, fieldName, actorId) {
  if (typeof dataUrl !== 'string' || dataUrl.trim() === '') {
    return existingId || null;
  }

  const normalizedData = dataUrl.trim();
  const fileType = inferFileTypeFromDataUrl(normalizedData);
  const fileName = `${fieldName}-${Date.now()}`;

  if (existingId) {
    await connection.query(
      `UPDATE attachment
       SET file_name = ?, file_type = ?, base64_data = ?, modified_by = ?, modified_date = NOW()
       WHERE id = ?`,
      [fileName, fileType, normalizedData, actorId || null, existingId]
    );
    return existingId;
  }

  const [result] = await connection.query(
    `INSERT INTO attachment (file_name, file_type, base64_data, created_by)
     VALUES (?, ?, ?, ?)`,
    [fileName, fileType, normalizedData, actorId || null]
  );
  return result.insertId;
}

async function getActiveOrganisation() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
      o.id,
      o.org_code,
      o.org_name,
      o.description,
      o.phone_number,
      o.email,
      o.address,
      o.website,
      o.add_seal,
      logo.base64_data AS logo_data,
      header.base64_data AS header_data,
      footer.base64_data AS footer_data,
      seal.base64_data AS seal_data
    FROM organization o
    LEFT JOIN attachment logo ON logo.id = o.logo_id
    LEFT JOIN attachment header ON header.id = o.header_id
    LEFT JOIN attachment footer ON footer.id = o.footer_id
    LEFT JOIN attachment seal ON seal.id = o.seal_id
    WHERE o.is_deleted = 0
    ORDER BY o.is_active DESC, o.id ASC
    LIMIT 1`
  );

  return mapOrganisationRow(rows && rows[0] ? rows[0] : null);
}

async function saveOrganisation(payload, actorId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT *
       FROM organization
       WHERE is_deleted = 0
       ORDER BY is_active DESC, id ASC
       LIMIT 1
       FOR UPDATE`
    );
    const existing = existingRows && existingRows[0] ? existingRows[0] : null;

    const logoId = await upsertAttachment(connection, existing ? existing.logo_id : null, payload.logo, 'logo', actorId);
    const headerId = await upsertAttachment(connection, existing ? existing.header_id : null, payload.headerImage, 'header', actorId);
    const footerId = await upsertAttachment(connection, existing ? existing.footer_id : null, payload.footerImage, 'footer', actorId);
    const sealId = await upsertAttachment(connection, existing ? existing.seal_id : null, payload.sealImage, 'seal', actorId);

    const orgName = String(payload.name || '').trim() || 'Dental Clinic';
    const orgCode = (String(payload.code || '').trim() || 'DENTAL_CLINIC').toUpperCase();
    const addSeal = payload.addSeal ? 1 : 0;

    if (existing) {
      await connection.query(
        `UPDATE organization
         SET org_name = ?,
             description = ?,
             phone_number = ?,
             email = ?,
             address = ?,
             website = ?,
             add_seal = ?,
             logo_id = ?,
             header_id = ?,
             footer_id = ?,
             seal_id = ?,
             modified_by = ?,
             modified_date = NOW()
         WHERE id = ?`,
        [
          orgName,
          payload.description || null,
          payload.phone || null,
          payload.email || null,
          payload.address || null,
          payload.website || null,
          addSeal,
          logoId,
          headerId,
          footerId,
          sealId,
          actorId || null,
          existing.id
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO organization (
          org_code, org_name, description, phone_number, email, address, website,
          add_seal, logo_id, header_id, footer_id, seal_id, is_active, is_deleted, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [
          orgCode,
          orgName,
          payload.description || null,
          payload.phone || null,
          payload.email || null,
          payload.address || null,
          payload.website || null,
          addSeal,
          logoId,
          headerId,
          footerId,
          sealId,
          actorId || null
        ]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getActiveOrganisation();
}

module.exports = {
  getActiveOrganisation,
  saveOrganisation
};

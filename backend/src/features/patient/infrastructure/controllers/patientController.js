const {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  listPatientMedicalRecords,
  createPatientMedicalRecord,
  deletePatientMedicalRecord
} = require('../repositories/mysqlPatientRepository');

async function getPatients(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const result = await listPatients(page, limit, q);
    return res.json({
      patients: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function createPatientHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const createdPatientId = await createPatient(payload, actorId);
    const result = await listPatients(page, limit, q);
    return res.status(201).json({
      message: 'Patient created successfully',
      createdPatientId,
      patients: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function updatePatientHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const patientId = Number(req.params.id);
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    await updatePatient(patientId, payload, actorId);
    const result = await listPatients(page, limit, q);
    return res.json({
      message: 'Patient updated successfully',
      patients: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function deletePatientHandler(req, res, next) {
  try {
    const patientId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    await deletePatient(patientId);
    const result = await listPatients(page, limit, q);
    return res.json({
      message: 'Patient deleted successfully',
      patients: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function getPatientMedicalRecordsHandler(req, res, next) {
  try {
    const patientId = Number(req.params.id);
    const records = await listPatientMedicalRecords(patientId);
    return res.json({ records });
  } catch (err) {
    return next(err);
  }
}

async function createPatientMedicalRecordHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const patientId = Number(req.params.id);
    await createPatientMedicalRecord(patientId, req.body || {}, actorId);
    const records = await listPatientMedicalRecords(patientId);
    return res.status(201).json({
      message: 'Medical record saved successfully',
      records
    });
  } catch (err) {
    return next(err);
  }
}

async function deletePatientMedicalRecordHandler(req, res, next) {
  try {
    const patientId = Number(req.params.id);
    const recordId = Number(req.params.recordId);
    await deletePatientMedicalRecord(patientId, recordId);
    const records = await listPatientMedicalRecords(patientId);
    return res.json({
      message: 'Medical record deleted successfully',
      records
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPatients,
  createPatientHandler,
  updatePatientHandler,
  deletePatientHandler,
  getPatientMedicalRecordsHandler,
  createPatientMedicalRecordHandler,
  deletePatientMedicalRecordHandler
};

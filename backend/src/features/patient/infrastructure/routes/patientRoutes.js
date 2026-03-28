const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const {
  getPatients,
  createPatientHandler,
  updatePatientHandler,
  deletePatientHandler,
  getPatientMedicalRecordsHandler,
  createPatientMedicalRecordHandler,
  deletePatientMedicalRecordHandler
} = require('../controllers/patientController');

const router = express.Router();

router.get('/', authRequired, getPatients);
router.post('/', authRequired, createPatientHandler);
router.put('/:id', authRequired, updatePatientHandler);
router.delete('/:id', authRequired, deletePatientHandler);
router.get('/:id/medical-records', authRequired, getPatientMedicalRecordsHandler);
router.post('/:id/medical-records', authRequired, createPatientMedicalRecordHandler);
router.delete('/:id/medical-records/:recordId', authRequired, deletePatientMedicalRecordHandler);

module.exports = router;

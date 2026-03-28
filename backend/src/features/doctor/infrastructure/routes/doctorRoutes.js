const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const {
  getDoctors,
  createDoctorHandler,
  updateDoctorHandler,
  deleteDoctorHandler
} = require('../controllers/doctorController');

const router = express.Router();

router.get('/', authRequired, getDoctors);
router.post('/', authRequired, createDoctorHandler);
router.put('/:id', authRequired, updateDoctorHandler);
router.delete('/:id', authRequired, deleteDoctorHandler);

module.exports = router;

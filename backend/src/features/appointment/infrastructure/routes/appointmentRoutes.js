const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const {
  getAppointments,
  createAppointmentHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler
} = require('../controllers/appointmentController');

const router = express.Router();

router.get('/', authRequired, getAppointments);
router.post('/', authRequired, createAppointmentHandler);
router.put('/:id', authRequired, updateAppointmentHandler);
router.delete('/:id', authRequired, deleteAppointmentHandler);

module.exports = router;

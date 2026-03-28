const {
  listAppointments,
  hasDoctorTimeConflict,
  createAppointment,
  updateAppointment,
  deleteAppointment
} = require('../repositories/mysqlAppointmentRepository');

async function getAppointments(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const result = await listAppointments(page, limit, {
      search: req.query.q,
      date: req.query.date,
      month: req.query.month
    });
    return res.json({
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function createAppointmentHandler(req, res, next) {
  try {
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;

    const hasConflict = await hasDoctorTimeConflict(payload.doctorId, payload.appointmentDate, payload.startTime, payload.endTime);
    if (hasConflict) {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }

    await createAppointment(payload);
    const result = await listAppointments(page, limit, {
      search: req.query.q,
      date: req.query.date,
      month: req.query.month
    });
    return res.status(201).json({
      message: 'Appointment created successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }
    return next(err);
  }
}

async function updateAppointmentHandler(req, res, next) {
  try {
    const payload = req.body || {};
    const appointmentId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;

    const hasConflict = await hasDoctorTimeConflict(
      payload.doctorId,
      payload.appointmentDate,
      payload.startTime,
      payload.endTime,
      appointmentId
    );
    if (hasConflict) {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }

    await updateAppointment(appointmentId, payload);
    const result = await listAppointments(page, limit, {
      search: req.query.q,
      date: req.query.date,
      month: req.query.month
    });
    return res.json({
      message: 'Appointment updated successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }
    return next(err);
  }
}

async function deleteAppointmentHandler(req, res, next) {
  try {
    const appointmentId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;
    await deleteAppointment(appointmentId);
    const result = await listAppointments(page, limit, {
      search: req.query.q,
      date: req.query.date,
      month: req.query.month
    });
    return res.json({
      message: 'Appointment deleted successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAppointments,
  createAppointmentHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler
};

const {
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff
} = require('../repositories/mysqlStaffRepository');

async function getStaff(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const result = await listStaff(page, limit, q);
    return res.json({
      staff: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function createStaffHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    await createStaff(payload, actorId);
    const result = await listStaff(page, limit, q);
    return res.status(201).json({
      message: 'Staff created successfully',
      staff: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function updateStaffHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const staffId = Number(req.params.id);
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    await updateStaff(staffId, payload, actorId);
    const result = await listStaff(page, limit, q);
    return res.json({
      message: 'Staff updated successfully',
      staff: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteStaffHandler(req, res, next) {
  try {
    const staffId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    await deleteStaff(staffId);
    const result = await listStaff(page, limit, q);
    return res.json({
      message: 'Staff deleted successfully',
      staff: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getStaff,
  createStaffHandler,
  updateStaffHandler,
  deleteStaffHandler
};

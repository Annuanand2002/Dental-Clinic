const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const {
  getStaff,
  createStaffHandler,
  updateStaffHandler,
  deleteStaffHandler
} = require('../controllers/staffController');

const router = express.Router();

router.get('/', authRequired, requireElevatedRole, getStaff);
router.post('/', authRequired, requireElevatedRole, createStaffHandler);
router.put('/:id', authRequired, requireElevatedRole, updateStaffHandler);
router.delete('/:id', authRequired, requireElevatedRole, deleteStaffHandler);

module.exports = router;

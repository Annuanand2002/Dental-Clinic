const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const { patchUserActive } = require('../controllers/usersController');

const router = express.Router();

router.patch('/:id/active', authRequired, requireElevatedRole, patchUserActive);

module.exports = router;

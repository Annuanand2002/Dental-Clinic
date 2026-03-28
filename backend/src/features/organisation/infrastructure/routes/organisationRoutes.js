const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const { getOrganisation, updateOrganisation } = require('../controllers/organisationController');

const router = express.Router();

router.get('/', authRequired, requireElevatedRole, getOrganisation);
router.put('/', authRequired, requireElevatedRole, updateOrganisation);

module.exports = router;

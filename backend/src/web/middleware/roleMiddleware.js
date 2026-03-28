const { isElevatedRole } = require('../../core/auth/appRoles');

/**
 * Requires a valid JWT (use after authRequired) and role Super Admin or Admin.
 */
function requireElevatedRole(req, res, next) {
  const role = req.auth && req.auth.role;
  if (!isElevatedRole(role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
}

module.exports = { requireElevatedRole };

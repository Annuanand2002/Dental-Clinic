/**
 * Roles that may use the staff/admin application (login + API access).
 * Must match `user_role.role_name` values in the database.
 */
const ALLOWED_APP_ROLES = Object.freeze(['Super Admin', 'Admin', 'Staff']);

/** Roles that may manage staff APIs and user account activation. */
const ELEVATED_ROLES = Object.freeze(['Super Admin', 'Admin']);

function isAllowedAppRole(roleName) {
  if (!roleName || typeof roleName !== 'string') return false;
  return ALLOWED_APP_ROLES.includes(roleName);
}

function isElevatedRole(roleName) {
  if (!roleName || typeof roleName !== 'string') return false;
  return ELEVATED_ROLES.includes(roleName);
}

module.exports = { ALLOWED_APP_ROLES, ELEVATED_ROLES, isAllowedAppRole, isElevatedRole };

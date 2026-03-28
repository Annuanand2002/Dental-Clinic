const jwt = require('jsonwebtoken');
const { isAllowedAppRole } = require('../../core/auth/appRoles');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!isAllowedAppRole(decoded.role)) {
      return res.status(403).json({ message: 'Access denied for this account' });
    }
    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { authRequired };


const { getPool } = require('../../../../core/db/pool');

async function setUserActive(userId, isActive) {
  const pool = getPool();
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) {
    const err = new Error('Invalid user id');
    err.statusCode = 400;
    throw err;
  }
  const flag = isActive ? 1 : 0;
  const [result] = await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [flag, id]);
  if (!result.affectedRows) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return { id, isActive: !!flag };
}

module.exports = { setUserActive };

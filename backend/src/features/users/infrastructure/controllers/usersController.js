const { setUserActive } = require('../repositories/mysqlUsersRepository');

async function patchUserActive(req, res, next) {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const raw = body.isActive;
    if (typeof raw !== 'boolean') {
      return res.status(400).json({ message: 'isActive (boolean) is required' });
    }
    const result = await setUserActive(id, raw);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { patchUserActive };

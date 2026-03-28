const express = require('express');
const { login } = require('../controllers/authController');
const { authRequired } = require('../../../../web/middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', authRequired, (req, res) => {
  res.json({ auth: req.auth });
});

module.exports = router;


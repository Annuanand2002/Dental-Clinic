const { loginUseCase } = require('../../domain/usecases/loginUseCase');
const { findByUsernameOrEmailAndPassword } = require('../repositories/mysqlAuthRepository');
const jwtService = require('../../../../core/auth/jwtService');
const { UnauthorizedError } = require('../../../../core/domain/errors/UnauthorizedError');

async function login(req, res, next) {
  try {
    const { usernameOrEmail, password } = req.body || {};

    if (typeof usernameOrEmail !== 'string' || usernameOrEmail.trim().length === 0) {
      return res.status(400).json({ message: 'username/email is required' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'password is required' });
    }

    const result = await loginUseCase(
      {
        authRepository: { findByUsernameOrEmailAndPassword },
        jwtService
      },
      {
        usernameOrEmail: usernameOrEmail.trim(),
        password
      }
    );

    return res.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    return next(err);
  }
}

module.exports = { login };


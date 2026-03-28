const { UnauthorizedError } = require('../../../../core/domain/errors/UnauthorizedError');

/**
 * Login use-case.
 * Compares the password in plain text (as requested).
 */
async function loginUseCase({ authRepository, jwtService }, { usernameOrEmail, password }) {
  const user = await authRepository.findByUsernameOrEmailAndPassword(usernameOrEmail, password);
  if (!user) {
    throw new UnauthorizedError('Invalid username/email or password');
  }

  const tokenPayload = {
    sub: String(user.id),
    username: user.username,
    role: user.role_name || null
  };

  const token = jwtService.signAccessToken(tokenPayload);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_name || null
    }
  };
}

module.exports = { loginUseCase };


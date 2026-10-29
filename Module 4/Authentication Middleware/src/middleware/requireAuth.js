// src/middleware/requireAuth.js
const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  // 1. Read the header (empty string if missing)
  const authHeader = req.headers.authorization ?? '';

  // 2. Extract the token, only if the header starts with "Bearer "
  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  const token = match ? match[1] : null;

  // 3. Exit A: no token, return 401
  if (!token) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  }

  // 4. Verify the token
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Exit B: verified, so attach the user and continue
    req.user = payload;
    next();
  } catch (_error) {
    // Exit C: verification failed, so send the same 401
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  }
};

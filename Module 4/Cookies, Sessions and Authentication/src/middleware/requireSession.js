'use strict';

const prisma = require('../db/prisma');
const sessionStore = require('../session/sessionStore');

const GENERIC_UNAUTHORIZED_ERROR = {
  error: {
    code: 'AUTH_REQUIRED',
    message: 'Authentication required',
  },
};

/**
 * Middleware that guards protected routes using signed session cookies.
 *
 * 1. Reads the signed session cookie `sid` from req.signedCookies.
 * 2. Resolves the server-side session from the in-memory session store.
 * 3. Resolves and attaches the user's identity to req.user.
 * 4. Returns a generic 401 response for all invalid/expired/tampered states.
 */
module.exports = async function requireSession(req, res, next) {
  try {
    const sid = req.signedCookies && req.signedCookies.sid;

    // Reject missing, non-string, or tampered (false) signed cookies
    if (!sid || typeof sid !== 'string') {
      return res.status(401).json(GENERIC_UNAUTHORIZED_ERROR);
    }

    // Resolve session from the server store (automatically checks TTL expiration)
    const session = sessionStore.get(sid);
    if (!session || session.userId == null) {
      return res.status(401).json(GENERIC_UNAUTHORIZED_ERROR);
    }

    // Resolve user from database to ensure user still exists and attach fresh identity
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      sessionStore.destroy(sid);
      return res.status(401).json(GENERIC_UNAUTHORIZED_ERROR);
    }

    // Attach identity and session to the request
    req.user = user;
    req.userId = user.id;
    req.session = session;
    req.sessionId = sid;

    return next();
  } catch (error) {
    return next(error);
  }
};
